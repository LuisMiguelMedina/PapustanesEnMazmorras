import { FC, useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useDebugMode } from '../hooks/useDebugMode';
import {
  CalendarEvent,
  CalendarEventOccurrence,
  CalendarEventTag,
  DEFAULT_TAGS,
  DEFAULT_CALENDAR_AUTHORS,
  PRESET_EVENT_STYLES,
  RecurrenceType,
} from '../models/Calendar/CalendarModels';
import { daysBetweenIso, shiftIsoDate, uniqueIsoDates } from './calendar/calendarDateUtils';
import { CalendarDataAccess } from '../dataAccess/CalendarDataAccess';
import './InteractiveCalendar.scss';

type FollowTab = 'FULL' | 'DM' | 'EVENT';

function formatMonthYear(date: Date): string {
  const rawMonth = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(date);
  const capitalized = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
  return `${capitalized} ${date.getFullYear()}`;
}

export const InteractiveCalendar: FC = () => {
  const isDebug = useDebugMode();

  // Actual = calendar month containing today; Siguiente = next month only (no past months)
  const anchorMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const [monthOffset, setMonthOffset] = useState<0 | 1>(0);

  const displayDate = useMemo(() => {
    return new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + monthOffset, 1);
  }, [anchorMonth, monthOffset]);

  const currentMonthLabel = useMemo(() => formatMonthYear(anchorMonth), [anchorMonth]);
  const nextMonthLabel = useMemo(() => {
    const next = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 1);
    return formatMonthYear(next);
  }, [anchorMonth]);

  const [events, setEvents] = useState<CalendarEvent[]>([]);

  // Dynamic tags state loaded from Firebase and local storage
  const filterCategoryTags = (loaded: CalendarEventTag[]) =>
    loaded.filter((t) => t.category === 'TYPE');

  const [tags, setTags] = useState<CalendarEventTag[]>(() => {
    try {
      const stored = localStorage.getItem('mom_calendar_tags');
      const parsed: CalendarEventTag[] = stored ? JSON.parse(stored) : DEFAULT_TAGS;
      const typeOnly = filterCategoryTags(parsed);
      return typeOnly.length > 0 ? typeOnly : DEFAULT_TAGS;
    } catch {
      return DEFAULT_TAGS;
    }
  });

  // Tag Manager Modal state (?debug=1)
  const [showTagModal, setShowTagModal] = useState<boolean>(false);
  const [editingTag, setEditingTag] = useState<CalendarEventTag | null>(null);
  const [tagFormLabel, setTagFormLabel] = useState<string>('');
  const tagFormCategory: 'TYPE' = 'TYPE';
  const [tagFormColor, setTagFormColor] = useState<string>('#8a58f5');
  const [tagFormTextColor, setTagFormTextColor] = useState<string>('#ffffff');
  const [tagActionMsg, setTagActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [showEventModal, setShowEventModal] = useState<boolean>(false);
  const [showFollowModal, setShowFollowModal] = useState<boolean>(false);
  const [followTab, setFollowTab] = useState<FollowTab>('FULL');
  const [selectedFollowDm, setSelectedFollowDm] = useState<string>('PAC');
  const [selectedFollowEventId, setSelectedFollowEventId] = useState<string>('');

  // Calendar capture state and DOM ref
  const calendarCaptureRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'IDLE' | 'COPYING' | 'COPIED' | 'DOWNLOADED'>('IDLE');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editingOccurrence, setEditingOccurrence] = useState<CalendarEventOccurrence | null>(null);
  const [draggingOccurrence, setDraggingOccurrence] = useState<CalendarEventOccurrence | null>(null);
  const [dropHighlightDate, setDropHighlightDate] = useState<string | null>(null);
  const [recurringScopePrompt, setRecurringScopePrompt] = useState<{
    kind: 'delete' | 'move';
    occurrence: CalendarEventOccurrence;
    targetDate?: string;
  } | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formTime, setFormTime] = useState<string>('');
  const [formAuthor, setFormAuthor] = useState<string>('PAC');
  const [formCategory, setFormCategory] = useState<string>('CAMPAÑA');
  const [formStyleId, setFormStyleId] = useState<string>('elixir_gradient');
  const [formCustomColor, setFormCustomColor] = useState<string>('');
  const [formCustomTextColor, setFormCustomTextColor] = useState<string>('#ffffff');
  const [formRecurrence, setFormRecurrence] = useState<RecurrenceType>('NONE');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Subscribe to Firebase RTDB on mount
  useEffect(() => {
    const unsubscribe = CalendarDataAccess.SubscribeEvents(
      (loadedEvents) => {
        setEvents(loadedEvents);

        if (loadedEvents.length > 0 && !selectedFollowEventId) {
          setSelectedFollowEventId(loadedEvents[0].id);
        }
      },
      (errorMsg) => {
        console.warn('Calendar sync error:', errorMsg);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [selectedFollowEventId]);

  // Subscribe to Firebase RTDB calendar tags
  useEffect(() => {
    const unsubTags = CalendarDataAccess.SubscribeTags((loadedTags) => {
      if (loadedTags && loadedTags.length > 0) {
        const typeOnly = filterCategoryTags(loadedTags);
        setTags(typeOnly.length > 0 ? typeOnly : DEFAULT_TAGS);
      }
    });

    return () => {
      unsubTags();
    };
  }, []);

  // Tag Management Handlers (?debug=1)
  const handleOpenTagManager = (tagToEdit?: CalendarEventTag) => {
    if (tagToEdit) {
      setEditingTag(tagToEdit);
      setTagFormLabel(tagToEdit.label);
      setTagFormColor(tagToEdit.color);
      setTagFormTextColor(tagToEdit.textColor);
    } else {
      setEditingTag(null);
      setTagFormLabel('');
      setTagFormColor('#8a58f5');
      setTagFormTextColor('#ffffff');
    }
    setTagActionMsg(null);
    setShowTagModal(true);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagFormLabel.trim()) return;

    const id = editingTag?.id || tagFormLabel.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    const tagData: CalendarEventTag = {
      id,
      label: tagFormLabel.trim().toUpperCase(),
      category: tagFormCategory,
      color: tagFormColor,
      textColor: tagFormTextColor,
    };

    const res = await CalendarDataAccess.SaveTag(tagData);
    if (res.CodeNumber === 200 && res.Result) {
      setTags((prev) => {
        const idx = prev.findIndex((t) => t.id === tagData.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = tagData;
          return next;
        }
        return [...prev, tagData];
      });
      setTagActionMsg({ type: 'success', text: `Etiqueta "${tagData.label}" guardada exitosamente.` });
      setEditingTag(null);
      setTagFormLabel('');
    } else {
      setTagActionMsg({ type: 'error', text: res.Message || 'Error al guardar la etiqueta.' });
    }
  };

  const handleDeleteTag = async (tagId: string, tagLabel: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la etiqueta "${tagLabel}"?`)) {
      return;
    }
    const res = await CalendarDataAccess.DeleteTag(tagId);
    if (res.CodeNumber === 200) {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      if (editingTag?.id === tagId) {
        setEditingTag(null);
        setTagFormLabel('');
      }
      setTagActionMsg({ type: 'success', text: `Etiqueta "${tagLabel}" eliminada.` });
    } else {
      setTagActionMsg({ type: 'error', text: res.Message || 'Error al eliminar la etiqueta.' });
    }
  };

  const handleResetTags = async () => {
    if (!window.confirm('¿Deseas restablecer todas las etiquetas a los valores originales por defecto?')) {
      return;
    }
    const res = await CalendarDataAccess.ResetDefaultTags();
    if (res.CodeNumber === 200 && res.Result) {
      setTags(res.Result);
      setEditingTag(null);
      setTagFormLabel('');
      setTagActionMsg({ type: 'success', text: 'Etiquetas restablecidas a valores iniciales.' });
    }
  };

  const currentYear = displayDate.getFullYear();
  const currentMonth = displayDate.getMonth();

  const canGoPrev = monthOffset === 1;
  const canGoNext = monthOffset === 0;

  const handlePrevMonth = () => {
    if (canGoPrev) setMonthOffset(0);
  };

  const handleNextMonth = () => {
    if (canGoNext) setMonthOffset(1);
  };

  const monthTitle = useMemo(() => formatMonthYear(displayDate), [displayDate]);

  // Compute calendar grid days for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startingDayIndex = firstDay.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days: Array<{
      dayNumber: number | null;
      dateString: string | null;
      isCurrentMonth: boolean;
    }> = [];

    // Empty padding slots before 1st day of month
    for (let i = 0; i < startingDayIndex; i++) {
      days.push({ dayNumber: null, dateString: null, isCurrentMonth: false });
    }

    // Days of current month (1..31)
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateString = `${currentYear}-${monthStr}-${dayStr}`;
      days.push({ dayNumber: d, dateString, isCurrentMonth: true });
    }

    // Padding at end to complete full rows of 7
    while (days.length % 7 !== 0) {
      days.push({ dayNumber: null, dateString: null, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Expand recurring events across the month
  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, CalendarEventOccurrence[]>();

    events.forEach((evt) => {
      const baseParts = evt.date.split('-');
      if (baseParts.length !== 3) return;
      const baseYear = parseInt(baseParts[0], 10);
      const baseMonth = parseInt(baseParts[1], 10) - 1;
      const baseDay = parseInt(baseParts[2], 10);
      const baseEventDate = new Date(baseYear, baseMonth, baseDay);
      const baseWeekday = baseEventDate.getDay();

      if (evt.recurrence === 'NONE') {
        const list = map.get(evt.date) || [];
        list.push({ event: evt, instanceDate: evt.date, isRecurringInstance: false });
        map.set(evt.date, list);
        return;
      }

      // Compute occurrences for all days of this month
      const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let d = 1; d <= totalDaysInMonth; d++) {
        const checkDate = new Date(currentYear, currentMonth, d);
        if (checkDate < baseEventDate) continue;

        const checkWeekday = checkDate.getDay();
        if (checkWeekday !== baseWeekday) continue;

        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        if (evt.skippedOccurrenceDates?.includes(dateStr)) {
          continue;
        }

        if (evt.recurrence === 'WEEKLY') {
          const list = map.get(dateStr) || [];
          list.push({ event: evt, instanceDate: dateStr, isRecurringInstance: dateStr !== evt.date });
          map.set(dateStr, list);
        } else if (evt.recurrence === 'BIWEEKLY') {
          const diffMs = checkDate.getTime() - baseEventDate.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays % 14 === 0) {
            const list = map.get(dateStr) || [];
            list.push({ event: evt, instanceDate: dateStr, isRecurringInstance: dateStr !== evt.date });
            map.set(dateStr, list);
          }
        } else if (evt.recurrence === 'MONTHLY') {
          if (d === baseDay) {
            const list = map.get(dateStr) || [];
            list.push({ event: evt, instanceDate: dateStr, isRecurringInstance: dateStr !== evt.date });
            map.set(dateStr, list);
          }
        }
      }
    });

    return map;
  }, [events, currentYear, currentMonth]);

  // Open modal to create a new event
  const handleOpenCreateModal = (targetDate?: string) => {
    setSelectedEvent(null);
    setEditingOccurrence(null);
    setFormTitle('');
    const defaultDate =
      targetDate ||
      `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    setFormDate(defaultDate);
    setFormTime('20:00');
    setFormAuthor('PAPUSTANES');
    const defaultCategory = tags.find((t) => t.label === 'CAMPAÑA') || tags[0];
    setFormCategory(defaultCategory?.label || 'CAMPAÑA');
    const initialPreset = PRESET_EVENT_STYLES[0];
    if (initialPreset) {
      setFormStyleId(initialPreset.id);
      setFormCustomColor(
        initialPreset.background.startsWith('linear-gradient') ? '#f5a623' : initialPreset.background,
      );
      setFormCustomTextColor(initialPreset.textColor);
    } else {
      setFormStyleId('custom');
      setFormCustomColor('#38b6ff');
      setFormCustomTextColor('#000000');
    }
    setFormRecurrence('NONE');
    setFormDesc('');
    setFormError('');
    setShowEventModal(true);
  };

  // Open modal to edit an existing event
  const handleOpenEditModal = (occurrence: CalendarEventOccurrence) => {
    const evt = occurrence.event;
    setSelectedEvent(evt);
    setEditingOccurrence(occurrence);
    setFormTitle(evt.title);
    setFormDate(occurrence.instanceDate);
    setFormTime(evt.time || '20:00');
    setFormAuthor(evt.authorTag || 'PAPUSTANES');
    setFormCategory(evt.categoryTag || 'CAMPAÑA');

    const matchedPreset =
      PRESET_EVENT_STYLES.find((p) => p.id === evt.visualStyleId) ||
      PRESET_EVENT_STYLES.find((p) => p.background.toLowerCase() === evt.colorVariant?.toLowerCase());
    if (matchedPreset) {
      setFormStyleId(matchedPreset.id);
      setFormCustomColor(
        matchedPreset.background.startsWith('linear-gradient') ? '#f5a623' : matchedPreset.background,
      );
      setFormCustomTextColor(matchedPreset.textColor);
    } else {
      setFormStyleId('custom');
      setFormCustomColor(evt.colorVariant);
      setFormCustomTextColor(evt.textColor || '#ffffff');
    }

    setFormRecurrence(evt.recurrence);
    setFormDesc(evt.description || '');
    setFormError('');
    setShowEventModal(true);
  };

  // Save (Create or Update) event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('El título del evento es obligatorio.');
      return;
    }
    if (!formDate.trim()) {
      setFormError('La fecha del evento es obligatoria.');
      return;
    }
    if (!formTime.trim()) {
      setFormError('La hora del evento es estrictamente obligatoria.');
      return;
    }

    let colorVariant = '#38b6ff';
    let textColor = '#000000';

    const selectedPreset = PRESET_EVENT_STYLES.find((p) => p.id === formStyleId);
    if (selectedPreset) {
      colorVariant = selectedPreset.background;
      textColor = selectedPreset.textColor;
    } else if (formStyleId === 'custom' && formCustomColor) {
      colorVariant = formCustomColor;
      textColor = formCustomTextColor;
    } else if (PRESET_EVENT_STYLES.length > 0) {
      colorVariant = PRESET_EVENT_STYLES[0].background;
      textColor = PRESET_EVENT_STYLES[0].textColor;
    }

    setIsSubmitting(true);
    setFormError('');

    const eventPayload: CalendarEvent = {
      id: selectedEvent ? selectedEvent.id : `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: formTitle.trim(),
      date: formDate,
      time: formTime.trim(),
      authorTag: formAuthor,
      categoryTag: formCategory,
      colorVariant,
      textColor,
      visualStyleId: selectedPreset ? selectedPreset.id : formStyleId === 'custom' ? 'custom' : undefined,
      recurrence: formRecurrence,
      description: formDesc.trim(),
      skippedOccurrenceDates: selectedEvent?.skippedOccurrenceDates,
    };

    const res = await CalendarDataAccess.SaveEvent(eventPayload);
    setIsSubmitting(false);

    if (res.CodeNumber === 200) {
      setShowEventModal(false);
    } else {
      setFormError(res.Message || 'Error al guardar el evento');
    }
  };

  const skipOccurrenceOnSeries = async (evt: CalendarEvent, instanceDate: string) => {
    const skipped = uniqueIsoDates([...(evt.skippedOccurrenceDates || []), instanceDate]);
    return CalendarDataAccess.SaveEvent({ ...evt, skippedOccurrenceDates: skipped });
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    if (selectedEvent.recurrence !== 'NONE' && editingOccurrence) {
      setRecurringScopePrompt({ kind: 'delete', occurrence: editingOccurrence });
      return;
    }

    const confirmDelete = window.confirm(`¿Estás seguro de eliminar el evento "${selectedEvent.title}"?`);
    if (!confirmDelete) return;

    setIsSubmitting(true);
    const res = await CalendarDataAccess.DeleteEvent(selectedEvent.id);
    setIsSubmitting(false);

    if (res.CodeNumber === 200) {
      setShowEventModal(false);
      setEditingOccurrence(null);
    } else {
      setFormError(res.Message || 'Error al eliminar el evento');
    }
  };

  const handleDeleteSingleOccurrence = async () => {
    const prompt = recurringScopePrompt;
    if (!prompt || prompt.kind !== 'delete') return;
    const evt = prompt.occurrence.event;
    setIsSubmitting(true);
    const res = await skipOccurrenceOnSeries(evt, prompt.occurrence.instanceDate);
    setIsSubmitting(false);
    setRecurringScopePrompt(null);
    if (res.CodeNumber === 200) {
      setShowEventModal(false);
      setEditingOccurrence(null);
    } else {
      setFormError(res.Message || 'No se pudo omitir esta ocurrencia');
    }
  };

  const handleDeleteEntireSeries = async () => {
    const prompt = recurringScopePrompt;
    if (!prompt || prompt.kind !== 'delete') return;
  const evt = prompt.occurrence.event;
    setIsSubmitting(true);
    const res = await CalendarDataAccess.DeleteEvent(evt.id);
    setIsSubmitting(false);
    setRecurringScopePrompt(null);
    if (res.CodeNumber === 200) {
      setShowEventModal(false);
      setEditingOccurrence(null);
    } else {
      setFormError(res.Message || 'Error al eliminar la serie');
    }
  };

  const handleDropOccurrence = (occurrence: CalendarEventOccurrence, targetDate: string) => {
    if (occurrence.instanceDate === targetDate) return;
    const evt = occurrence.event;
    if (evt.recurrence === 'NONE') {
      void (async () => {
        setIsSubmitting(true);
        const res = await CalendarDataAccess.SaveEvent({ ...evt, date: targetDate });
        setIsSubmitting(false);
        if (res.CodeNumber !== 200) {
          window.alert(res.Message || 'No se pudo mover el evento');
        }
      })();
      return;
    }
    setRecurringScopePrompt({ kind: 'move', occurrence, targetDate });
  };

  const handleMoveSingleOccurrence = async () => {
    const prompt = recurringScopePrompt;
    if (!prompt || prompt.kind !== 'move' || !prompt.targetDate) return;
    const evt = prompt.occurrence.event;
    const fromDate = prompt.occurrence.instanceDate;
    const toDate = prompt.targetDate;
    setIsSubmitting(true);
    const skipRes = await skipOccurrenceOnSeries(evt, fromDate);
    if (skipRes.CodeNumber !== 200) {
      setIsSubmitting(false);
      setFormError(skipRes.Message || 'No se pudo omitir la fecha original');
      return;
    }
    const oneOff: CalendarEvent = {
      ...evt,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: toDate,
      recurrence: 'NONE',
      skippedOccurrenceDates: undefined,
    };
    const createRes = await CalendarDataAccess.SaveEvent(oneOff);
    setIsSubmitting(false);
    setRecurringScopePrompt(null);
    if (createRes.CodeNumber !== 200) {
      setFormError(createRes.Message || 'No se pudo crear el evento en la nueva fecha');
    }
  };

  const handleMoveEntireSeries = async () => {
    const prompt = recurringScopePrompt;
    if (!prompt || prompt.kind !== 'move' || !prompt.targetDate) return;
    const evt = prompt.occurrence.event;
    const delta = daysBetweenIso(prompt.occurrence.instanceDate, prompt.targetDate);
    const newAnchor = shiftIsoDate(evt.date, delta);
    setIsSubmitting(true);
    const res = await CalendarDataAccess.SaveEvent({ ...evt, date: newAnchor });
    setIsSubmitting(false);
    setRecurringScopePrompt(null);
    if (res.CodeNumber === 200) {
      setShowEventModal(false);
      setEditingOccurrence(null);
    } else {
      setFormError(res.Message || 'No se pudo mover la serie');
    }
  };

  // Helper to trigger file download (supports string content or binary Blob)
  const downloadBlob = (content: string | Blob, filename: string) => {
    const blob = typeof content === 'string' ? new Blob([content], { type: 'text/calendar;charset=utf-8' }) : content;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Copy Calendar Image to Clipboard (or fallback download) with Month and Year included
  const handleCopyCalendar = async () => {
    if (!calendarCaptureRef.current || copyStatus === 'COPYING') return;

    try {
      setCopyStatus('COPYING');

      const element = calendarCaptureRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0c0e14',
        useCORS: true,
        logging: false,
        windowWidth: 1200,
        onclone: (_clonedDoc, clonedElement) => {
          clonedElement.style.width = '960px';
          clonedElement.style.maxWidth = '960px';
          clonedElement.style.padding = '22px 24px 26px';
          clonedElement.style.background = '#0c0e14';
          clonedElement.style.borderRadius = '16px';
          clonedElement.style.boxSizing = 'border-box';

          // Show the header containing the Month and Year prominently
          const header = clonedElement.querySelector('.capture-header') as HTMLElement | null;
          if (header) {
            header.style.display = 'flex';
          }

          // Hide interactive add buttons and debug buttons from the output image
          const quickAddBtns = clonedElement.querySelectorAll('.btn-cell-quick-add');
          quickAddBtns.forEach((btn) => {
            (btn as HTMLElement).style.display = 'none';
          });

          const debugElements = clonedElement.querySelectorAll('.btn-debug-manage-tags, .debug-tag-icon');
          debugElements.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        },
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('No se pudo generar la imagen del calendario.');
        }

        const fileName = `calendario-${monthTitle.toLowerCase().replace(/\s+/g, '-')}.png`;

        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          try {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            setCopyStatus('COPIED');
            setTimeout(() => setCopyStatus('IDLE'), 3000);
            return;
          } catch (clipErr) {
            console.warn('Clipboard write failed, downloading image instead:', clipErr);
          }
        }

        downloadBlob(blob, fileName);
        setCopyStatus('DOWNLOADED');
        setTimeout(() => setCopyStatus('IDLE'), 3500);
      }, 'image/png');
    } catch (error) {
      console.error('Error al capturar calendario:', error);
      setCopyStatus('IDLE');
      alert('No se pudo copiar la imagen del calendario. Por favor intenta de nuevo.');
    }
  };

  // Download full calendar .ICS
  const handleDownloadFullIcs = () => {
    const icsContent = CalendarDataAccess.GenerateIcsCalendar(
      events,
      'Papustanes en Mazmorras - Calendario Completo',
    );
    downloadBlob(icsContent, `papustanes-calendario-completo-${currentYear}-${currentMonth + 1}.ics`);
  };

  // Download DM specific .ICS
  const handleDownloadDmIcs = (dm: string) => {
    const dmEvents = events.filter((e) => e.authorTag.toUpperCase() === dm.toUpperCase());
    const icsContent = CalendarDataAccess.GenerateIcsCalendar(
      dmEvents,
      `Papustanes en Mazmorras - Partidas de ${dm}`,
    );
    downloadBlob(icsContent, `papustanes-dm-${dm.toLowerCase()}-${currentYear}-${currentMonth + 1}.ics`);
  };

  // Download Single Event .ICS
  const handleDownloadSingleEventIcs = (event: CalendarEvent) => {
    const icsContent = CalendarDataAccess.GenerateIcsCalendar(
      [event],
      `Papustanes en Mazmorras - ${event.title}`,
    );
    const safeTitle = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadBlob(icsContent, `papustanes-evento-${safeTitle}.ics`);
  };

  // Open follow modal with specific tab
  const handleOpenFollowModal = (tab: FollowTab) => {
    setFollowTab(tab);
    setShowFollowModal(true);
  };

  const weekdays = [
    { id: 'dom', full: 'DOMINGO', short: 'DOM' },
    { id: 'lun', full: 'LUNES', short: 'LUN' },
    { id: 'mar', full: 'MARTES', short: 'MAR' },
    { id: 'mie', full: 'MIÉRCOLES', short: 'MIÉ' },
    { id: 'jue', full: 'JUEVES', short: 'JUE' },
    { id: 'vie', full: 'VIERNES', short: 'VIE' },
    { id: 'sab', full: 'SÁBADO', short: 'SÁB' },
  ];

  // Filter events for the selected DM in the follow modal
  const dmEventsList = useMemo(() => {
    return events.filter((e) => e.authorTag.toUpperCase() === selectedFollowDm.toUpperCase());
  }, [events, selectedFollowDm]);

  // Current selected event in the follow modal
  const currentFollowEvent = useMemo(() => {
    return events.find((e) => e.id === selectedFollowEventId) || events[0] || null;
  }, [events, selectedFollowEventId]);

  return (
    <div className="interactive-calendar-wrapper">
      {/* ---------------- 1. HEADER & LEGEND BAR ---------------- */}
      <div className="calendar-top-section">
        <div className="calendar-controls-row">
          <div className="title-and-sync">
            <div className="month-navigation-wrap">
              <button
                type="button"
                className={`btn-month-nav ${!canGoPrev ? 'disabled' : ''}`}
                onClick={handlePrevMonth}
                disabled={!canGoPrev}
                title={canGoPrev ? `Volver al mes actual (${currentMonthLabel})` : 'Límite: este es el mes actual'}
                aria-label="Mes anterior"
              >
                <i className="fas fa-chevron-left" />
              </button>

              <h2 className="calendar-month-heading">{monthTitle}</h2>

              <button
                type="button"
                className={`btn-month-nav ${!canGoNext ? 'disabled' : ''}`}
                onClick={handleNextMonth}
                disabled={!canGoNext}
                title={canGoNext ? `Ver mes siguiente (${nextMonthLabel})` : 'Límite: solo se permite ver el mes siguiente'}
                aria-label="Mes siguiente"
              >
                <i className="fas fa-chevron-right" />
              </button>
            </div>

            <div className="month-segmented-toggle">
              <button
                type="button"
                className={`btn-toggle-month ${monthOffset === 0 ? 'active' : ''}`}
                onClick={() => setMonthOffset(0)}
              >
                {currentMonthLabel} (Actual)
              </button>
              <button
                type="button"
                className={`btn-toggle-month ${monthOffset === 1 ? 'active' : ''}`}
                onClick={() => setMonthOffset(1)}
              >
                {nextMonthLabel} (Siguiente)
              </button>
            </div>
          </div>

          {/* Actions bar with Seguir Completo, Seguir DM, Seguir Evento */}
          <div className="calendar-action-toolbar">
            <button
              type="button"
              className="btn-calendar-add"
              onClick={() => handleOpenCreateModal()}
              title="Añadir nueva sesión o evento al calendario compartido"
            >
              <i className="fas fa-plus me-1" />
              <span className="btn-label-desktop">Nuevo Evento</span>
              <span className="btn-label-mobile">Evento</span>
            </button>

            <button
              type="button"
              className={`btn-calendar-copy ${copyStatus === 'COPIED' ? 'copied' : ''}`}
              onClick={handleCopyCalendar}
              disabled={copyStatus === 'COPYING'}
              title="Copiar imagen del calendario al portapapeles con el mes y año incluidos"
            >
              {copyStatus === 'COPYING' ? (
                <>
                  <i className="fas fa-spinner fa-spin me-1" />
                  <span className="btn-label-desktop">Copiando...</span>
                  <span className="btn-label-mobile">Copiando</span>
                </>
              ) : copyStatus === 'COPIED' ? (
                <>
                  <i className="fas fa-check me-1" />
                  <span className="btn-label-desktop">¡Calendario Copiado!</span>
                  <span className="btn-label-mobile">¡Copiado!</span>
                </>
              ) : copyStatus === 'DOWNLOADED' ? (
                <>
                  <i className="fas fa-download me-1" />
                  <span className="btn-label-desktop">¡Imagen Guardada!</span>
                  <span className="btn-label-mobile">Guardado</span>
                </>
              ) : (
                <>
                  <i className="fas fa-camera me-1" />
                  <span className="btn-label-desktop">Copiar Calendario</span>
                  <span className="btn-label-mobile">Copiar</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-calendar-follow btn-follow-full"
              onClick={() => handleOpenFollowModal('FULL')}
              title="Seguir el calendario completo en Google Calendar"
            >
              <i className="fab fa-google me-1" />
              <span className="btn-label-desktop">Seguir Completo</span>
              <span className="btn-label-mobile">Seguir Todo</span>
            </button>

            <button
              type="button"
              className="btn-calendar-follow btn-follow-dm"
              onClick={() => handleOpenFollowModal('DM')}
              title="Seguir partidas de un DM en particular"
            >
              <i className="fas fa-user-shield me-1" />
              <span className="btn-label-desktop">Seguir DM</span>
              <span className="btn-label-mobile">Por DM</span>
            </button>

            <button
              type="button"
              className="btn-calendar-follow btn-follow-event"
              onClick={() => handleOpenFollowModal('EVENT')}
              title="Seguir un evento o campaña específica en Google Calendar"
            >
              <i className="fas fa-dice-d20 me-1" />
              <span className="btn-label-desktop">Seguir Evento</span>
              <span className="btn-label-mobile">Por Evento</span>
            </button>

            {isDebug && (
              <button
                type="button"
                className="btn-debug-manage-tags"
                onClick={() => handleOpenTagManager()}
                title="Administrar categorías de evento (?debug=1)"
              >
                <i className="fas fa-sliders-h me-1" />
                <span className="btn-label-desktop">Categorías</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- 2. CALENDAR MONTH GRID & CAPTURE AREA ---------------- */}
      <div ref={calendarCaptureRef} className="calendar-capture-area">
        {/* Header included in the captured image with Month and Year */}
        <div className="capture-header">
          <div className="capture-brand">
            <span className="brand-badge">PAPUSTANES EN MAZMORRAS</span>
          </div>
          <h2 className="capture-month-title">{monthTitle}</h2>
          <span className="capture-subtitle">CALENDARIO DE SESIONES Y EVENTOS</span>
        </div>

        {/* Calendar Month Grid */}
        <div className="calendar-grid-card">
        {/* Days of the week header */}
        <div className="calendar-weekdays-row">
          {weekdays.map((day) => (
            <div key={day.id} className="calendar-weekday-header">
              <span className="weekday-full">{day.full}</span>
              <span className="weekday-short">{day.short}</span>
            </div>
          ))}
        </div>

        {/* Month days cells */}
        <div className="calendar-days-grid">
          {calendarDays.map((cell, index) => {
            if (!cell.isCurrentMonth || !cell.dateString) {
              return <div key={`empty-${index}`} className="calendar-cell cell-empty" />;
            }

            const dayOccurrences = occurrencesByDate.get(cell.dateString) || [];
            const isToday =
              cell.dayNumber === new Date().getDate() &&
              currentMonth === new Date().getMonth() &&
              currentYear === new Date().getFullYear();

            return (
              <div
                key={cell.dateString}
                className={`calendar-cell cell-active ${isToday ? 'cell-today' : ''} ${
                  dropHighlightDate === cell.dateString ? 'cell-drop-target' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropHighlightDate(cell.dateString);
                }}
                onDragLeave={() => {
                  if (dropHighlightDate === cell.dateString) {
                    setDropHighlightDate(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggingOccurrence && cell.dateString) {
                    handleDropOccurrence(draggingOccurrence, cell.dateString);
                  }
                  setDraggingOccurrence(null);
                  setDropHighlightDate(null);
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    handleOpenCreateModal(cell.dateString!);
                  }
                }}
              >
                <div className="cell-top-bar">
                  <span className="day-number">{cell.dayNumber}</span>
                  <button
                    type="button"
                    className="btn-cell-quick-add"
                    title={`Añadir evento el ${cell.dayNumber} de ${monthTitle}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCreateModal(cell.dateString!);
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Event pills on this day */}
                <div className="cell-events-list">
                  {dayOccurrences.map((occ, occIdx) => {
                    const evt = occ.event;
                    return (
                      <div
                        key={`${evt.id}-${occIdx}`}
                        className={`calendar-event-pill ${
                          draggingOccurrence?.event.id === evt.id &&
                          draggingOccurrence.instanceDate === occ.instanceDate
                            ? 'is-dragging'
                            : ''
                        }`}
                        style={{
                          background: evt.colorVariant,
                          color: evt.textColor || '#000000',
                        }}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggingOccurrence(occ);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggingOccurrence(null);
                          setDropHighlightDate(null);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(occ);
                        }}
                        title={`${evt.title} (${evt.time}) - Organiza: ${evt.authorTag}${
                          evt.recurrence !== 'NONE' ? ' [Recurrente]' : ''
                        }. Arrastra a otro día para cambiar la fecha.`}
                      >
                        <span className="pill-time-badge">{evt.time}</span>
                        <span className="pill-title-text">{evt.title}</span>
                        {evt.recurrence !== 'NONE' && (
                          <i className="fas fa-redo-alt pill-recurring-icon ms-1" title="Evento recurrente" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {/* ---------------- 3. CREATE / EDIT EVENT MODAL ---------------- */}
      {showEventModal && (
        <div className="calendar-modal-backdrop" onClick={() => setShowEventModal(false)}>
          <div className="calendar-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-cyber">
              <h3>
                <i className={selectedEvent ? 'fas fa-edit me-2' : 'fas fa-calendar-plus me-2'} />
                {selectedEvent ? 'Modificar Evento' : 'Crear Evento en el Calendario'}
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowEventModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="modal-form-cyber">
              <div className="modal-body-scrollable">
                {formError && (
                <div className="form-error-alert" role="alert">
                  <i className="fas fa-exclamation-circle me-1" />
                  {formError}
                </div>
              )}

              {/* Event Title */}
              <div className="form-row">
                <label>
                  Título del Evento <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: ELIXIR, RE:VEIL, Pokémon: Neo Frontier..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              {/* Date and Mandatory Time */}
              <div className="form-grid-2">
                <div className="form-row">
                  <label>
                    Fecha <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <label>
                    Hora de Inicio / Duración <span className="text-danger">* (Obligatorio)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 19:30 o 20:00 - 23:30"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Categoría (etiquetas por defecto) */}
              <div className="form-row">
                <label>Categoría</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.label}>
                      {tag.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recurrence (Google Calendar style) */}
              <div className="form-row">
                <label>
                  <i className="fas fa-sync-alt me-1 text-info" />
                  Repetición del Evento (Estilo Google Calendar)
                </label>
                <select
                  value={formRecurrence}
                  onChange={(e) => setFormRecurrence(e.target.value as RecurrenceType)}
                >
                  <option value="NONE">No se repite</option>
                  <option value="WEEKLY">Cada semana en este día</option>
                  <option value="BIWEEKLY">Cada 2 semanas (Quincenal)</option>
                  <option value="MONTHLY">Cada mes</option>
                </select>
                <small className="form-help-text">
                  Los eventos recurrentes se multiplicarán automáticamente en todos los días aplicables del mes.
                </small>
              </div>

              {/* Visual Style Selection */}
              <div className="form-row">
                <label>Color del evento</label>
                <div className="style-preset-selector">
                  {PRESET_EVENT_STYLES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-style-btn preset-style-btn--swatch ${
                        formStyleId === preset.id ? 'active' : ''
                      }`}
                      style={{ background: preset.background, color: preset.textColor }}
                      onClick={() => {
                        setFormStyleId(preset.id);
                        setFormCustomColor(
                          preset.background.startsWith('linear-gradient') ? '#f5a623' : preset.background,
                        );
                        setFormCustomTextColor(preset.textColor);
                      }}
                      title={preset.label}
                      aria-label={preset.label}
                    />
                  ))}
                  <button
                    type="button"
                    className={`preset-style-btn preset-style-btn--custom ${
                      formStyleId === 'custom' ? 'active' : ''
                    }`}
                    onClick={() => setFormStyleId('custom')}
                    title="Color personalizado para este evento"
                  >
                    Personalizado
                  </button>
                </div>
                {formStyleId === 'custom' && (
                  <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                    <input
                      type="color"
                      className="color-picker-input-cyber"
                      value={formCustomColor.startsWith('#') ? formCustomColor : '#38b6ff'}
                      onChange={(e) => setFormCustomColor(e.target.value)}
                      aria-label="Color de fondo del evento"
                    />
                    <button
                      type="button"
                      className={`btn-tag-text-color ${formCustomTextColor === '#ffffff' ? 'active' : ''}`}
                      onClick={() => setFormCustomTextColor('#ffffff')}
                    >
                      Texto blanco
                    </button>
                    <button
                      type="button"
                      className={`btn-tag-text-color ${formCustomTextColor === '#000000' ? 'active' : ''}`}
                      onClick={() => setFormCustomTextColor('#000000')}
                    >
                      Texto negro
                    </button>
                  </div>
                )}
              </div>

              {/* Notes / Description */}
              <div className="form-row">
                <label>Descripción / Detalles de la Sesión</label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre el arco narrativo, canal de voz o requerimientos..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

              </div>

              {/* Modal Actions */}
              <div className="modal-actions-bar">
                {selectedEvent && (
                  <div className="modal-left-actions">
                    <button
                      type="button"
                      className="btn-danger-cyber"
                      onClick={handleDeleteEvent}
                      disabled={isSubmitting}
                    >
                      <i className="fas fa-trash me-1" />
                      Eliminar
                    </button>
                    <a
                      href={CalendarDataAccess.GetGoogleCalendarDirectUrl(selectedEvent, formDate)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-gcal-direct"
                      title="Abrir y guardar este evento en mi Google Calendar"
                    >
                      <i className="fab fa-google me-1" />
                      Añadir a Google Calendar
                    </a>
                  </div>
                )}

                <div className="modal-right-actions">
                  <button
                    type="button"
                    className="btn-cancel-cyber"
                    onClick={() => setShowEventModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-submit-cyber" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <span className="spinner-border spinner-border-sm me-1" />
                    ) : (
                      <i className="fas fa-save me-1" />
                    )}
                    {selectedEvent ? 'Guardar Cambios' : 'Registrar en Firebase'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- 4. "SEGUIR CALENDARIO" MULTI-MODO (COMPLETO / DM / EVENTO) ---------------- */}
      {showFollowModal && (
        <div className="calendar-modal-backdrop" onClick={() => setShowFollowModal(false)}>
          <div className="calendar-modal-container follow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-cyber">
              <h3>
                <i className="fab fa-google me-2 text-info" />
                Seguir en Google Calendar
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowFollowModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Mode selection tabs */}
            <div className="follow-modal-tabs">
              <button
                type="button"
                className={`tab-btn ${followTab === 'FULL' ? 'active' : ''}`}
                onClick={() => setFollowTab('FULL')}
              >
                <i className="fas fa-globe me-1" />
                Calendario Completo
              </button>
              <button
                type="button"
                className={`tab-btn ${followTab === 'DM' ? 'active' : ''}`}
                onClick={() => setFollowTab('DM')}
              >
                <i className="fas fa-user-shield me-1" />
                Seguir por DM
              </button>
              <button
                type="button"
                className={`tab-btn ${followTab === 'EVENT' ? 'active' : ''}`}
                onClick={() => setFollowTab('EVENT')}
              >
                <i className="fas fa-dice-d20 me-1" />
                Seguir Evento
              </button>
            </div>

            <div className="follow-modal-body">
              {/* TAB 1: CALENDARIO COMPLETO */}
              {followTab === 'FULL' && (
                <div className="tab-content-panel">
                  <p className="follow-intro">
                    Sincroniza <strong>todas las campañas y eventos de Papustanes en Mazmorras ({events.length} crónicas)</strong> en
                    tu Google Calendar personal.
                  </p>

                  <div className="follow-options-grid">
                    <div className="follow-card">
                      <div className="card-icon-box">
                        <i className="fas fa-calendar-check" />
                      </div>
                      <h4>Descargar .ICS Completo</h4>
                      <p>
                        Exporta todas las fechas, horas y recurrencias de todas las campañas en formato iCalendar estándar.
                      </p>
                      <button type="button" className="btn-action-primary" onClick={handleDownloadFullIcs}>
                        <i className="fas fa-download me-1" />
                        Descargar Todo (.ICS)
                      </button>
                    </div>

                    <div className="follow-card">
                      <div className="card-icon-box">
                        <i className="fab fa-google" />
                      </div>
                      <h4>Importar en Google Calendar</h4>
                      <p>
                        Abre la consola de Google Calendar para subir el archivo descargado y sincronizar tu cuenta.
                      </p>
                      <a
                        href="https://calendar.google.com/calendar/u/0/r/settings/export"
                        target="_blank"
                        rel="noreferrer"
                        className="btn-action-secondary"
                      >
                        <i className="fas fa-external-link-alt me-1" />
                        Abrir Google Calendar Import
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SEGUIR POR DM */}
              {followTab === 'DM' && (
                <div className="tab-content-panel">
                  <p className="follow-intro">
                    Elige el Game Master que deseas seguir para agregar <strong>únicamente sus partidas</strong> a tu
                    Google Calendar.
                  </p>

                  <div className="dm-selector-box mb-3">
                    <label className="section-small-label">Selecciona tu Game Master / Organizador:</label>
                    <div className="dm-pills-row">
                      {DEFAULT_CALENDAR_AUTHORS.map((author) => (
                        <button
                          key={author}
                          type="button"
                          className={`dm-pick-btn ${selectedFollowDm === author ? 'active' : ''}`}
                          onClick={() => setSelectedFollowDm(author)}
                        >
                          {author}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="dm-events-summary-card">
                    <div className="dm-card-header">
                      <h5>
                        Partidas programadas por <strong>{selectedFollowDm}</strong> ({dmEventsList.length})
                      </h5>
                      {dmEventsList.length > 0 && (
                        <button
                          type="button"
                          className="btn-dm-download-ics"
                          onClick={() => handleDownloadDmIcs(selectedFollowDm)}
                          title={`Descargar archivo .ICS con todas las partidas de ${selectedFollowDm}`}
                        >
                          <i className="fas fa-download me-1" />
                          Descargar .ICS de {selectedFollowDm}
                        </button>
                      )}
                    </div>

                    {dmEventsList.length === 0 ? (
                      <p className="text-muted font-monospace py-2">
                        No hay partidas activas registradas con el DM {selectedFollowDm} en este momento.
                      </p>
                    ) : (
                      <div className="dm-events-items-list">
                        {dmEventsList.map((evt) => (
                          <div key={evt.id} className="dm-event-item-row">
                            <div className="dm-event-info">
                              <span
                                className="dm-event-badge"
                                style={{ background: evt.colorVariant, color: evt.textColor }}
                              >
                                {evt.time}
                              </span>
                              <strong className="dm-event-name">{evt.title}</strong>
                              <span className="dm-event-recur">
                                {evt.recurrence === 'WEEKLY'
                                  ? '(Semanal)'
                                  : evt.recurrence === 'BIWEEKLY'
                                  ? '(Quincenal)'
                                  : '(Único)'}
                              </span>
                            </div>

                            <a
                              href={CalendarDataAccess.GetGoogleCalendarDirectUrl(evt)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-gcal-quick-link"
                              title="Añadir esta serie directamente a Google Calendar en 1 clic"
                            >
                              <i className="fab fa-google me-1" />
                              Añadir a Google Calendar (1 Clic)
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: SEGUIR EVENTO ESPECÍFICO */}
              {followTab === 'EVENT' && (
                <div className="tab-content-panel">
                  <p className="follow-intro">
                    Selecciona una crónica o evento específico para sincronizar su serie completa directamente en tu cuenta de
                    Google Calendar con 1 clic.
                  </p>

                  <div className="form-row mb-3">
                    <label className="section-small-label">Selecciona el Evento o Campaña:</label>
                    <select
                      value={currentFollowEvent ? currentFollowEvent.id : ''}
                      onChange={(e) => setSelectedFollowEventId(e.target.value)}
                    >
                      {events.map((evt) => (
                        <option key={evt.id} value={evt.id}>
                          {evt.title} ({evt.time}) — DM: {evt.authorTag}
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentFollowEvent && (
                    <div className="event-focus-card">
                      <div className="event-focus-header">
                        <span
                          className="event-focus-pill"
                          style={{
                            background: currentFollowEvent.colorVariant,
                            color: currentFollowEvent.textColor,
                          }}
                        >
                          {currentFollowEvent.title}
                        </span>
                        <span className="event-focus-time">
                          <i className="fas fa-clock me-1 text-cyan" />
                          {currentFollowEvent.time}
                        </span>
                      </div>

                      <div className="event-focus-details">
                        <p>
                          <strong>Organizador:</strong> {currentFollowEvent.authorTag}
                        </p>
                        <p>
                          <strong>Frecuencia:</strong>{' '}
                          {currentFollowEvent.recurrence === 'WEEKLY'
                            ? 'Cada semana (Semanal)'
                            : currentFollowEvent.recurrence === 'BIWEEKLY'
                            ? 'Cada 2 semanas (Quincenal)'
                            : 'Evento único'}
                        </p>
                        {currentFollowEvent.description && (
                          <p>
                            <strong>Detalles:</strong> {currentFollowEvent.description}
                          </p>
                        )}
                      </div>

                      <div className="event-focus-actions">
                        <a
                          href={CalendarDataAccess.GetGoogleCalendarDirectUrl(currentFollowEvent)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-gcal-prominent"
                        >
                          <i className="fab fa-google me-2" />
                          Añadir esta serie a mi Google Calendar (1 Clic)
                        </a>

                        <button
                          type="button"
                          className="btn-action-download-event"
                          onClick={() => handleDownloadSingleEventIcs(currentFollowEvent)}
                        >
                          <i className="fas fa-download me-1" />
                          Descargar .ICS del Evento
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Instructions footer */}
              <div className="follow-instructions-box mt-3">
                <h5>
                  <i className="fas fa-info-circle me-1 text-cyan" />
                  ¿Cómo funciona la sincronización?
                </h5>
                <p className="mb-0">
                  El botón <strong>Añadir a Google Calendar (1 Clic)</strong> abre directamente la interfaz de Google Calendar
                  con el título, la hora obligatoria, la ubicación en Foundry VTT y la regla de recurrencia ya configurada.
                  También puedes usar los archivos <code>.ics</code> para importarlos en tu teléfono o aplicación de escritorio.
                </p>
              </div>
            </div>

            <div className="modal-actions-bar justify-content-end">
              <button
                type="button"
                className="btn-cancel-cyber"
                onClick={() => setShowFollowModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 5. TAG MANAGEMENT MODAL (DEBUG MODE ONLY) ---------------- */}
      {recurringScopePrompt && (
        <div className="calendar-modal-backdrop recurring-scope-backdrop">
          <div className="calendar-modal-container recurring-scope-modal">
            <div className="modal-header-cyber">
              <h3>
                <i className="fas fa-redo-alt me-2 text-warning" />
                {recurringScopePrompt.kind === 'delete' ? 'Eliminar evento recurrente' : 'Mover evento recurrente'}
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setRecurringScopePrompt(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body-scrollable">
              <p className="text-light mb-3">
                «{recurringScopePrompt.occurrence.event.title}» el{' '}
                <strong>{recurringScopePrompt.occurrence.instanceDate}</strong>
                {recurringScopePrompt.kind === 'move' && recurringScopePrompt.targetDate
                  ? ` → ${recurringScopePrompt.targetDate}`
                  : ''}
                . ¿Qué deseas hacer?
              </p>
              <div className="d-flex flex-column gap-2">
                <button
                  type="button"
                  className="btn-submit-cyber"
                  disabled={isSubmitting}
                  onClick={() =>
                    recurringScopePrompt.kind === 'delete'
                      ? void handleDeleteSingleOccurrence()
                      : void handleMoveSingleOccurrence()
                  }
                >
                  Solo esta fecha
                </button>
                <button
                  type="button"
                  className="btn-action-secondary"
                  disabled={isSubmitting}
                  onClick={() =>
                    recurringScopePrompt.kind === 'delete'
                      ? void handleDeleteEntireSeries()
                      : void handleMoveEntireSeries()
                  }
                >
                  {recurringScopePrompt.kind === 'delete'
                    ? 'Eliminar toda la serie'
                    : 'Mover toda la serie'}
                </button>
                <button
                  type="button"
                  className="btn-cancel-cyber"
                  onClick={() => setRecurringScopePrompt(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTagModal && isDebug && (
        <div className="calendar-modal-backdrop" onClick={() => setShowTagModal(false)}>
          <div
            className="calendar-modal-container tags-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-cyber">
              <h3>
                <i className="fas fa-tags me-2 text-warning" />
                Categorías de evento (tipo / color por defecto)
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowTagModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-scrollable">
              {tagActionMsg && (
                <div
                  className={`alert ${
                    tagActionMsg.type === 'success' ? 'alert-success' : 'alert-danger'
                  } py-2 px-3 mb-3 font-monospace`}
                  style={{ fontSize: '0.8rem' }}
                >
                  <i
                    className={`fas ${
                      tagActionMsg.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'
                    } me-2`}
                  />
                  {tagActionMsg.text}
                </div>
              )}

              {/* Tag Editor Form */}
              <div className="tag-editor-card mb-4">
                <div className="editor-card-header d-flex justify-content-between align-items-center mb-3">
                  <h4 className="mb-0 fs-6 text-uppercase fw-bold text-amber">
                    <i className={`fas ${editingTag ? 'fa-edit text-info' : 'fa-plus text-warning'} me-2`} />
                    {editingTag ? `Modificar Etiqueta: ${editingTag.label}` : 'Nueva Etiqueta'}
                  </h4>
                  {editingTag && (
                    <button
                      type="button"
                      className="btn-tag-cancel-edit"
                      onClick={() => {
                        setEditingTag(null);
                        setTagFormLabel('');
                        setTagFormColor('#8a58f5');
                        setTagFormTextColor('#ffffff');
                      }}
                    >
                      <i className="fas fa-plus me-1" />
                      Nueva Etiqueta
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveTag} className="tag-form-fields">
                  <div className="row g-2 mb-2">
                    <div className="col-md-6 form-row">
                      <label>Nombre / Texto de la Etiqueta</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: KAI, WEAS CORTAS, ONE-SHOT"
                        value={tagFormLabel}
                        onChange={(e) => setTagFormLabel(e.target.value)}
                      />
                    </div>

                  </div>

                  <div className="row g-2 mb-3 align-items-center">
                    <div className="col-md-6 form-row">
                      <label>Color de Fondo</label>
                      <div className="d-flex align-items-center gap-2">
                        <input
                          type="color"
                          className="color-picker-input-cyber"
                          value={tagFormColor}
                          onChange={(e) => setTagFormColor(e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-control-cyber"
                          placeholder="#5814e5"
                          value={tagFormColor}
                          onChange={(e) => setTagFormColor(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="col-md-6 form-row">
                      <label>Color de Texto</label>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className={`btn-tag-text-color ${tagFormTextColor === '#ffffff' ? 'active' : ''}`}
                          onClick={() => setTagFormTextColor('#ffffff')}
                          style={{
                            background: '#1c1917',
                            color: '#ffffff',
                            border: tagFormTextColor === '#ffffff' ? '2px solid #f97316' : '1px solid #444',
                          }}
                        >
                          Blanco (#FFF)
                        </button>
                        <button
                          type="button"
                          className={`btn-tag-text-color ${tagFormTextColor === '#000000' ? 'active' : ''}`}
                          onClick={() => setTagFormTextColor('#000000')}
                          style={{
                            background: '#ffffff',
                            color: '#000000',
                            border: tagFormTextColor === '#000000' ? '2px solid #f97316' : '1px solid #ccc',
                          }}
                        >
                          Negro (#000)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="tag-live-preview-box mb-3 d-flex align-items-center gap-3">
                    <span className="preview-label">Vista Previa:</span>
                    <span
                      className="legend-pill"
                      style={{ background: tagFormColor, color: tagFormTextColor }}
                    >
                      {tagFormLabel.trim() || 'VISTA PREVIA'}
                    </span>
                  </div>

                  <div className="d-flex justify-content-end gap-2">
                    <button type="submit" className="btn-save-tag-action">
                      <i className="fas fa-check me-1" />
                      {editingTag ? 'Actualizar Etiqueta' : '+ Guardar Etiqueta'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Tags List */}
              <div className="tags-management-list-section">
                <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                  <h4 className="mb-0 fs-6 text-uppercase fw-bold text-warning">
                    Etiquetas Registradas ({tags.length})
                  </h4>
                </div>

                <div className="tags-grid-items">
                  {tags.map((tag) => (
                      <div key={tag.id} className="tag-item-card">
                        <span
                          className="legend-pill"
                          style={{ background: tag.color, color: tag.textColor }}
                        >
                          {tag.label}
                        </span>

                        <div className="tag-item-actions">
                          <button
                            type="button"
                            className="btn-action-edit"
                            title="Editar esta categoría"
                            onClick={() => {
                              setEditingTag(tag);
                              setTagFormLabel(tag.label);
                              setTagFormColor(tag.color);
                              setTagFormTextColor(tag.textColor);
                              setTagActionMsg(null);
                            }}
                          >
                            <i className="fas fa-pen-to-square" />
                          </button>
                          <button
                            type="button"
                            className="btn-action-delete"
                            title="Eliminar esta etiqueta"
                            onClick={() => handleDeleteTag(tag.id, tag.label)}
                          >
                            <i className="fas fa-trash-can" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="modal-actions-bar d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn-reset-tags-action"
                onClick={handleResetTags}
                title="Restablecer todas las etiquetas a los valores originales por defecto"
              >
                <i className="fas fa-rotate-left me-1" />
                Restablecer Iniciales
              </button>
              <button
                type="button"
                className="btn-cancel-cyber"
                onClick={() => setShowTagModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
