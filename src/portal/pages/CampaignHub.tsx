import { FC, useState, useMemo } from 'react';
import { CampaignCarousel } from '../components/CampaignCarousel';
import { useDebugMode } from '../hooks/useDebugMode';
import { InteractiveCalendar } from '../components/InteractiveCalendar';
import {
  CampaignBase,
  CampaignStatusType,
  CampaignDifficultyType,
  CampaignCustomButton,
} from '../models/Campaigns/CampaignModels';
import { useCampaignHubViewModel } from '../viewModels/useCampaignHubViewModel';
import './CampaignHub.scss';

const LOCAL_CAMPAIGNS_KEY = 'mom_local_campaigns';
const OVERRIDES_CAMPAIGNS_KEY = 'mom_campaign_overrides';

// Priority ranking by campaign status:
// 1. ACTIVE (Activa)
// 2. UPCOMING (Próximamente)
// 3. DEVELOPMENT (En Desarrollo)
// 4. ARCHIVED (Terminada / Archivada)
const getCampaignStatusPriority = (status?: CampaignStatusType | string | null): number => {
  switch (status) {
    case 'ACTIVE':
      return 1;
    case 'UPCOMING':
      return 2;
    case 'DEVELOPMENT':
      return 3;
    case 'ARCHIVED':
      return 4;
    default:
      return 5;
  }
};

export const CampaignHub: FC = () => {
  const {
    activeCampaign,
    otherCampaigns,
    isLoading,
    errorMessage,
  } = useCampaignHubViewModel();

  const isDebug = useDebugMode();

  // Stored custom campaigns created by user
  const [localExtraCampaigns, setLocalExtraCampaigns] = useState<CampaignBase[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_CAMPAIGNS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Stored edits/overrides to any campaign
  const [campaignOverrides, setCampaignOverrides] = useState<Record<string, Partial<CampaignBase>>>(() => {
    try {
      const stored = localStorage.getItem(OVERRIDES_CAMPAIGNS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Create Campaign Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newSystem, setNewSystem] = useState<string>('D&D 5E Modificado');
  const [newDM, setNewDM] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newStatus, setNewStatus] = useState<CampaignStatusType>('UPCOMING');
  const [newDifficulty, setNewDifficulty] = useState<CampaignDifficultyType>('Intermedio');
  const [newPlayerCount, setNewPlayerCount] = useState<number | ''>('');
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [newFoundryUrl, setNewFoundryUrl] = useState<string>('');
  const [newCoverUrl, setNewCoverUrl] = useState<string>('');
  const [newBorderColor, setNewBorderColor] = useState<string>('');
  const [newButtonColor, setNewButtonColor] = useState<string>('');
  const [newCustomButtons, setNewCustomButtons] = useState<CampaignCustomButton[]>([]);

  // Edit Campaign Modal state
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignBase | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editSystem, setEditSystem] = useState<string>('');
  const [editDM, setEditDM] = useState<string>('');
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [editPlayerCount, setEditPlayerCount] = useState<number | ''>('');
  const [editDifficulty, setEditDifficulty] = useState<CampaignDifficultyType>('Intermedio');
  const [editStatus, setEditStatus] = useState<CampaignStatusType>('ACTIVE');
  const [editCoverUrl, setEditCoverUrl] = useState<string>('');
  const [editFoundryUrl, setEditFoundryUrl] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [editBorderColor, setEditBorderColor] = useState<string>('');
  const [editButtonColor, setEditButtonColor] = useState<string>('');
  const [editCustomButtons, setEditCustomButtons] = useState<CampaignCustomButton[]>([]);

  // Custom Buttons helpers
  const handleAddCustomButton = (isEdit: boolean) => {
    const newBtn: CampaignCustomButton = {
      id: `btn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      label: 'Enlace',
      url: 'https://',
      color: '',
    };
    if (isEdit) {
      setEditCustomButtons((prev) => [...prev, newBtn]);
    } else {
      setNewCustomButtons((prev) => [...prev, newBtn]);
    }
  };

  const handleUpdateCustomButton = (
    id: string,
    field: keyof CampaignCustomButton,
    value: string,
    isEdit: boolean
  ) => {
    const updater = (list: CampaignCustomButton[]) =>
      list.map((btn) => (btn.id === id ? { ...btn, [field]: value } : btn));
    if (isEdit) {
      setEditCustomButtons(updater);
    } else {
      setNewCustomButtons(updater);
    }
  };

  const handleRemoveCustomButton = (id: string, isEdit: boolean) => {
    if (isEdit) {
      setEditCustomButtons((prev) => prev.filter((b) => b.id !== id));
    } else {
      setNewCustomButtons((prev) => prev.filter((b) => b.id !== id));
    }
  };

  // Helper to handle image file upload (PNG, JPG, GIF) and convert to base64 DataURL
  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    isEdit: boolean
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isValidExt = ['png', 'jpg', 'jpeg', 'gif'].includes(ext || '');

    if (!validTypes.includes(file.type) && !isValidExt) {
      alert('Formato no compatible. Por favor sube una imagen PNG, JPG o GIF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es demasiado grande (máximo 5 MB) para almacenamiento local.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (isEdit) {
        setEditCoverUrl(result);
      } else {
        setNewCoverUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Consolidate all campaigns grouped and prioritized by status:
  // 1. ACTIVE (Activas)
  // 2. UPCOMING (Próximamente)
  // 3. DEVELOPMENT (En Desarrollo)
  // 4. ARCHIVED (Terminadas / Archivadas)
  const allCampaigns = useMemo<CampaignBase[]>(() => {
    const list: CampaignBase[] = [];
    if (activeCampaign) {
      list.push(activeCampaign);
    }
    list.push(...otherCampaigns);
    list.push(...localExtraCampaigns);

    const merged = list.map((camp) => {
      const override = campaignOverrides[camp.CampaignID];
      return override ? { ...camp, ...override } : camp;
    });

    // Deduplicate by CampaignID
    const uniqueMap = new Map<string, CampaignBase>();
    merged.forEach((camp) => {
      uniqueMap.set(camp.CampaignID, camp);
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const pA = getCampaignStatusPriority(a.CampaignStatus);
      const pB = getCampaignStatusPriority(b.CampaignStatus);
      if (pA !== pB) {
        return pA - pB;
      }
      return a.CampaignTitle.localeCompare(b.CampaignTitle);
    });
  }, [activeCampaign, otherCampaigns, localExtraCampaigns, campaignOverrides]);

  // Open Edit Modal with campaign's current data
  const handleOpenEditModal = (camp: CampaignBase) => {
    setEditingCampaign(camp);
    setEditTitle(camp.CampaignTitle);
    setEditSystem(camp.CampaignSystem);
    setEditDM(camp.CampaignGameMaster);
    setEditStartDate(camp.CampaignStartDate || '');
    setEditPlayerCount(camp.CampaignPlayerCount ?? '');
    setEditDifficulty((camp.CampaignDifficulty as CampaignDifficultyType) || 'Intermedio');
    setEditStatus(camp.CampaignStatus);
    setEditCoverUrl(camp.CampaignCoverUrl || '');
    setEditFoundryUrl(camp.CampaignFoundryUrl || '');
    setEditDesc(camp.CampaignDescription);
    setEditBorderColor(camp.CampaignBorderColor || '');
    setEditButtonColor(camp.CampaignButtonColor || '');
    setEditCustomButtons(camp.CampaignCustomButtons ? [...camp.CampaignCustomButtons] : []);
    setShowEditModal(true);
  };

  // Save changes to edited campaign
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;

    const updated: Partial<CampaignBase> = {
      CampaignTitle: editTitle.trim(),
      CampaignSystem: editSystem.trim(),
      CampaignGameMaster: editDM.trim(),
      CampaignStartDate: editStartDate.trim() || null,
      CampaignPlayerCount: editPlayerCount === '' ? null : Number(editPlayerCount),
      CampaignDifficulty: editDifficulty,
      CampaignStatus: editStatus,
      CampaignCoverUrl: editCoverUrl.trim() || null,
      CampaignFoundryUrl: editFoundryUrl.trim() || null,
      CampaignDescription: editDesc.trim(),
      CampaignBorderColor: editBorderColor.trim() || null,
      CampaignButtonColor: editButtonColor.trim() || null,
      CampaignCustomButtons: editCustomButtons.filter((b) => b.label.trim() && b.url.trim()),
    };

    setCampaignOverrides((prev) => {
      const next = {
        ...prev,
        [editingCampaign.CampaignID]: {
          ...prev[editingCampaign.CampaignID],
          ...updated,
        },
      };
      try {
        localStorage.setItem(OVERRIDES_CAMPAIGNS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });

    setShowEditModal(false);
    setEditingCampaign(null);
  };

  // Create new campaign
  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const created: CampaignBase = {
      CampaignID: slug,
      CampaignTitle: newTitle,
      CampaignSlug: slug,
      CampaignSystem: newSystem || 'D&D 5E Modificado',
      CampaignDescription: newDesc || 'Nueva crónica multiversal en preparación.',
      CampaignCoverUrl: newCoverUrl.trim() || null,
      CampaignBannerUrl: null,
      CampaignStatus: newStatus,
      CampaignGameMaster: newDM || 'Game Master',
      CampaignStartDate: newStartDate.trim() || 'Por anunciar',
      CampaignPlayerCount: newPlayerCount === '' ? null : Number(newPlayerCount),
      CampaignSessionCount: 0,
      CampaignDifficulty: newDifficulty,
      CampaignBorderColor: newBorderColor.trim() || null,
      CampaignButtonColor: newButtonColor.trim() || null,
      CampaignCustomButtons: newCustomButtons.filter((b) => b.label.trim() && b.url.trim()),
      CampaignFoundryUrl: newFoundryUrl.trim() || null,
      CampaignWikiHomeSlug: slug,
      CampaignTags: ['Comunidad', 'Nuevo Mundo'],
    };

    setLocalExtraCampaigns((prev) => {
      const next = [...prev, created];
      try {
        localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });

    setShowAddModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewDM('');
    setNewStartDate('');
    setNewPlayerCount('');
    setNewDifficulty('Intermedio');
    setNewFoundryUrl('');
    setNewCoverUrl('');
    setNewBorderColor('');
    setNewButtonColor('');
    setNewCustomButtons([]);
  };

  return (
    <div className="scifi-hub-container">
      {/* ---------------- 1. COMMAND HEADER ---------------- */}
      <header className="hub-command-header">
        <h1 className="header-main-title">
          Campañas
        </h1>

        {isDebug && (
          <div className="mt-2">
            <span
              className="badge d-inline-flex align-items-center gap-2 px-3 py-1 text-uppercase"
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid #f59e0b',
                color: '#fcd34d',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
              }}
            >
              <i className="fas fa-terminal" />
              Modo Debug Activo (?debug=1) // Edición y Creación Habilitadas
            </span>
          </div>
        )}
      </header>

      {errorMessage && (
        <div className="alert alert-danger font-monospace mb-4" role="alert">
          <i className="fas fa-exclamation-triangle me-2" />
          {errorMessage}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-5">
          <div className="spinner-border text-warning" role="status" />
          <p className="mt-2 text-muted font-monospace">Consultando los reinos y crónicas del multiverso...</p>
        </div>
      )}

      {/* ---------------- 2. CENTRALIZED WORLD SELECTOR CAROUSEL ---------------- */}
      <section className="hub-carousel-section">
        {!isLoading && (allCampaigns.length > 0 || isDebug) && (
          <CampaignCarousel
            campaigns={allCampaigns}
            isDebug={isDebug}
            onAddNewWorld={() => {
              if (isDebug) setShowAddModal(true);
            }}
            onEditCampaign={handleOpenEditModal}
          />
        )}
      </section>

      {/* ---------------- 3. INTERACTIVE SHARED CALENDAR (FIREBASE RTDB & GCAL) ---------------- */}
      <section className="hub-calendar-section">
        <InteractiveCalendar />
      </section>

      {/* ---------------- 4. ADD CAMPAIGN MODAL (ONLY IN DEBUG MODE) ---------------- */}
      {showAddModal && isDebug && (
        <div className="scifi-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="scifi-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-cyber">
              <h4>
                <i className="fas fa-scroll me-2 text-warning" />
                Registrar Nueva Crónica / Reino
              </h4>
              <button
                type="button"
                className="btn-close-cyber"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="modal-form-cyber">
              <div className="modal-body-scrollable">
                <div className="form-group mb-3">
                <label>Título de la Campaña / Mundo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Crónicas de los Eones: Éxodo"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-6 form-group">
                  <label>Sistema de Juego</label>
                  <input
                    type="text"
                    placeholder="Ej: D&D 5E, Cyberpunk RED..."
                    value={newSystem}
                    onChange={(e) => setNewSystem(e.target.value)}
                  />
                </div>
                <div className="col-md-6 form-group">
                  <label>Game Master</label>
                  <input
                    type="text"
                    placeholder="Nombre o alias del DM"
                    value={newDM}
                    onChange={(e) => setNewDM(e.target.value)}
                  />
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-4 form-group">
                  <label>Estado</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as CampaignStatusType)}
                  >
                    <option value="ACTIVE">Activa (ACTIVE)</option>
                    <option value="UPCOMING">Próximamente (UPCOMING)</option>
                    <option value="DEVELOPMENT">En Desarrollo (DEVELOPMENT)</option>
                    <option value="ARCHIVED">Archivada (ARCHIVED)</option>
                  </select>
                </div>
                <div className="col-md-4 form-group">
                  <label>Jugadores</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej: 4"
                    value={newPlayerCount}
                    onChange={(e) => setNewPlayerCount(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="col-md-4 form-group">
                  <label>Dificultad</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value as CampaignDifficultyType)}
                  >
                    <option value="Begginer friendly">Begginer friendly</option>
                    <option value="Intermedio">Intermedio</option>
                    <option value="Difícil">Difícil</option>
                    <option value="Hardcore">Hardcore</option>
                  </select>
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-6 form-group">
                  <label>Fecha de Inicio</label>
                  <input
                    type="text"
                    placeholder="Ej: 15 de febrero de 2024"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                  />
                </div>
                <div className="col-md-6 form-group">
                  <label>Enlace Foundry VTT</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newFoundryUrl}
                    onChange={(e) => setNewFoundryUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group mb-3">
                <label>
                  <i className="fas fa-image me-1 text-warning" />
                  Imagen de Portada (PNG, JPG o GIF)
                </label>
                <div className="image-input-container">
                  <div className="d-flex gap-2 mb-2 align-items-center flex-wrap">
                    <label className="btn-upload-file-label">
                      <i className="fas fa-cloud-arrow-up me-1" />
                      Subir archivo (PNG, JPG, GIF)
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,.png,.jpg,.jpeg,.gif"
                        className="visually-hidden"
                        onChange={(e) => handleImageFileChange(e, false)}
                      />
                    </label>
                    {newCoverUrl && (
                      <button
                        type="button"
                        className="btn-clear-img"
                        onClick={() => setNewCoverUrl('')}
                      >
                        <i className="fas fa-trash-can me-1" />
                        Quitar Imagen
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="O introduce enlace web: https://... (png, jpg, gif)"
                    value={newCoverUrl}
                    onChange={(e) => setNewCoverUrl(e.target.value)}
                  />

                  {newCoverUrl && (
                    <div className="image-preview-box mt-2">
                      <div className="preview-header">
                        <span>Vista Previa de Imagen:</span>
                        <span className="badge-img-type">
                          {newCoverUrl.startsWith('data:image/gif') || newCoverUrl.toLowerCase().endsWith('.gif')
                            ? 'GIF ANIMADO'
                            : newCoverUrl.startsWith('data:image/png') || newCoverUrl.toLowerCase().endsWith('.png')
                            ? 'PNG'
                            : newCoverUrl.startsWith('data:image/jpeg') || newCoverUrl.toLowerCase().endsWith('.jpg') || newCoverUrl.toLowerCase().endsWith('.jpeg')
                            ? 'JPG'
                            : 'IMAGEN WEB'}
                        </span>
                      </div>
                      <div className="preview-img-wrapper">
                        <img
                          src={newCoverUrl}
                          alt="Vista previa portada"
                          className="preview-img"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group mb-3">
                <label>Sinopsis / Ambientación</label>
                <textarea
                  rows={3}
                  placeholder="Describe brevemente la premisa del mundo y sus particularidades narrativas..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              {/* Personalización de Contorno, Botones y Enlaces */}
              <div className="custom-styling-section mb-3">
                <div className="section-title-label">
                  <i className="fas fa-palette me-2 text-warning" />
                  Personalización Visual y Botones de Enlace
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6 form-group mb-0">
                    <label>Color del Contorno / Borde</label>
                    <div className="color-picker-group">
                      <input
                        type="color"
                        className="color-picker-input"
                        value={newBorderColor || '#f97316'}
                        onChange={(e) => setNewBorderColor(e.target.value)}
                        title="Seleccionar color de contorno"
                      />
                      <input
                        type="text"
                        className="color-text-input"
                        placeholder="Por defecto (#f97316)"
                        value={newBorderColor}
                        onChange={(e) => setNewBorderColor(e.target.value)}
                      />
                      {newBorderColor && (
                        <button
                          type="button"
                          className="btn-color-reset"
                          title="Restablecer color predeterminado"
                          onClick={() => setNewBorderColor('')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="col-md-6 form-group mb-0">
                    <label>Color de Botones</label>
                    <div className="color-picker-group">
                      <input
                        type="color"
                        className="color-picker-input"
                        value={newButtonColor || '#ea580c'}
                        onChange={(e) => setNewButtonColor(e.target.value)}
                        title="Seleccionar color de botones"
                      />
                      <input
                        type="text"
                        className="color-text-input"
                        placeholder="Por defecto (#ea580c)"
                        value={newButtonColor}
                        onChange={(e) => setNewButtonColor(e.target.value)}
                      />
                      {newButtonColor && (
                        <button
                          type="button"
                          className="btn-color-reset"
                          title="Restablecer color predeterminado"
                          onClick={() => setNewButtonColor('')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subsección de botones personalizados con links */}
                <div className="custom-buttons-subgroup">
                  <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                    <label className="mb-0">
                      <i className="fas fa-link me-1 text-warning" />
                      Botones Adicionales (Enlaces Web)
                    </label>
                    <button
                      type="button"
                      className="btn-add-custom-link"
                      onClick={() => handleAddCustomButton(false)}
                    >
                      <i className="fas fa-plus me-1" />
                      Añadir Botón
                    </button>
                  </div>

                  {newCustomButtons.length === 0 ? (
                    <div className="custom-buttons-empty">
                      Sin botones de enlace adicionales. Haz clic en "+ Añadir Botón" para agregar botones personalizados.
                    </div>
                  ) : (
                    <div className="custom-buttons-list">
                      {newCustomButtons.map((btn, index) => (
                        <div key={btn.id} className="custom-btn-item-row">
                          <div className="btn-row-fields">
                            <div className="field-label-group">
                              <span className="field-num">#{index + 1}</span>
                              <input
                                type="text"
                                placeholder="Texto (ej. Discord, VTT)"
                                value={btn.label}
                                onChange={(e) =>
                                  handleUpdateCustomButton(btn.id, 'label', e.target.value, false)
                                }
                                className="input-btn-label"
                              />
                            </div>

                            <input
                              type="url"
                              placeholder="Enlace URL (https://...)"
                              value={btn.url}
                              onChange={(e) =>
                                handleUpdateCustomButton(btn.id, 'url', e.target.value, false)
                              }
                              className="input-btn-url"
                            />

                            <div className="color-field-inline" title="Color específico para este botón">
                              <input
                                type="color"
                                className="color-picker-input-small"
                                value={btn.color || newButtonColor || '#ea580c'}
                                onChange={(e) =>
                                  handleUpdateCustomButton(btn.id, 'color', e.target.value, false)
                                }
                              />
                              <input
                                type="text"
                                placeholder="Color"
                                value={btn.color || ''}
                                onChange={(e) =>
                                  handleUpdateCustomButton(btn.id, 'color', e.target.value, false)
                                }
                                className="input-btn-color-text"
                              />
                            </div>

                            <button
                              type="button"
                              className="btn-remove-custom-item"
                              title="Eliminar este botón"
                              onClick={() => handleRemoveCustomButton(btn.id, false)}
                            >
                              <i className="fas fa-trash-can" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              </div>

              <div className="modal-actions-cyber">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  <i className="fas fa-feather-pointed me-1" />
                  Añadir al Códice de Campañas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- 5. EDIT CAMPAIGN MODAL (ONLY IN DEBUG MODE) ---------------- */}
      {showEditModal && editingCampaign && isDebug && (
        <div className="scifi-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="scifi-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-cyber">
              <h4>
                <i className="fas fa-pen-to-square me-2 text-warning" />
                Editar Crónica: {editingCampaign.CampaignTitle}
              </h4>
              <button
                type="button"
                className="btn-close-cyber"
                onClick={() => setShowEditModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-form-cyber">
              <div className="modal-body-scrollable">
                <div className="form-group mb-3">
                <label>Título de la Crónica / Campaña</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-6 form-group">
                  <label>Sistema de Juego</label>
                  <input
                    type="text"
                    required
                    value={editSystem}
                    onChange={(e) => setEditSystem(e.target.value)}
                  />
                </div>
                <div className="col-md-6 form-group">
                  <label>Game Master</label>
                  <input
                    type="text"
                    required
                    value={editDM}
                    onChange={(e) => setEditDM(e.target.value)}
                  />
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-4 form-group">
                  <label>Estado</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CampaignStatusType)}
                  >
                    <option value="ACTIVE">Activa (ACTIVE)</option>
                    <option value="UPCOMING">Próximamente (UPCOMING)</option>
                    <option value="DEVELOPMENT">En Desarrollo (DEVELOPMENT)</option>
                    <option value="ARCHIVED">Archivada (ARCHIVED)</option>
                  </select>
                </div>
                <div className="col-md-4 form-group">
                  <label>Jugadores</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej: 4"
                    value={editPlayerCount}
                    onChange={(e) => setEditPlayerCount(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="col-md-4 form-group">
                  <label>Dificultad</label>
                  <select
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value as CampaignDifficultyType)}
                  >
                    <option value="Begginer friendly">Begginer friendly</option>
                    <option value="Intermedio">Intermedio</option>
                    <option value="Difícil">Difícil</option>
                    <option value="Hardcore">Hardcore</option>
                  </select>
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-md-6 form-group">
                  <label>Fecha de Inicio</label>
                  <input
                    type="text"
                    placeholder="Ej: 15 de febrero de 2024"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </div>
                <div className="col-md-6 form-group">
                  <label>Enlace Foundry VTT</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={editFoundryUrl}
                    onChange={(e) => setEditFoundryUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group mb-3">
                <label>
                  <i className="fas fa-image me-1 text-warning" />
                  Imagen de Portada (PNG, JPG o GIF)
                </label>
                <div className="image-input-container">
                  <div className="d-flex gap-2 mb-2 align-items-center flex-wrap">
                    <label className="btn-upload-file-label">
                      <i className="fas fa-cloud-arrow-up me-1" />
                      Subir archivo (PNG, JPG, GIF)
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,.png,.jpg,.jpeg,.gif"
                        className="visually-hidden"
                        onChange={(e) => handleImageFileChange(e, true)}
                      />
                    </label>
                    {editCoverUrl && (
                      <button
                        type="button"
                        className="btn-clear-img"
                        onClick={() => setEditCoverUrl('')}
                      >
                        <i className="fas fa-trash-can me-1" />
                        Quitar Imagen
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="O introduce enlace web: https://... (png, jpg, gif)"
                    value={editCoverUrl}
                    onChange={(e) => setEditCoverUrl(e.target.value)}
                  />

                  {editCoverUrl && (
                    <div className="image-preview-box mt-2">
                      <div className="preview-header">
                        <span>Vista Previa de Imagen:</span>
                        <span className="badge-img-type">
                          {editCoverUrl.startsWith('data:image/gif') || editCoverUrl.toLowerCase().endsWith('.gif')
                            ? 'GIF ANIMADO'
                            : editCoverUrl.startsWith('data:image/png') || editCoverUrl.toLowerCase().endsWith('.png')
                            ? 'PNG'
                            : editCoverUrl.startsWith('data:image/jpeg') || editCoverUrl.toLowerCase().endsWith('.jpg') || editCoverUrl.toLowerCase().endsWith('.jpeg')
                            ? 'JPG'
                            : 'IMAGEN WEB'}
                        </span>
                      </div>
                      <div className="preview-img-wrapper">
                        <img
                          src={editCoverUrl}
                          alt="Vista previa portada"
                          className="preview-img"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group mb-3">
                <label>Sinopsis / Descripción Narrativa</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              {/* Personalización de Contorno, Botones y Enlaces */}
              <div className="custom-styling-section mb-3">
                <div className="section-title-label">
                  <i className="fas fa-palette me-2 text-warning" />
                  Personalización Visual y Botones de Enlace
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6 form-group mb-0">
                    <label>Color del Contorno / Borde</label>
                    <div className="color-picker-group">
                      <input
                        type="color"
                        className="color-picker-input"
                        value={editBorderColor || '#f97316'}
                        onChange={(e) => setEditBorderColor(e.target.value)}
                        title="Seleccionar color de contorno"
                      />
                      <input
                        type="text"
                        className="color-text-input"
                        placeholder="Por defecto (#f97316)"
                        value={editBorderColor}
                        onChange={(e) => setEditBorderColor(e.target.value)}
                      />
                      {editBorderColor && (
                        <button
                          type="button"
                          className="btn-color-reset"
                          title="Restablecer color predeterminado"
                          onClick={() => setEditBorderColor('')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="col-md-6 form-group mb-0">
                    <label>Color de Botones</label>
                    <div className="color-picker-group">
                      <input
                        type="color"
                        className="color-picker-input"
                        value={editButtonColor || '#ea580c'}
                        onChange={(e) => setEditButtonColor(e.target.value)}
                        title="Seleccionar color de botones"
                      />
                      <input
                        type="text"
                        className="color-text-input"
                        placeholder="Por defecto (#ea580c)"
                        value={editButtonColor}
                        onChange={(e) => setEditButtonColor(e.target.value)}
                      />
                      {editButtonColor && (
                        <button
                          type="button"
                          className="btn-color-reset"
                          title="Restablecer color predeterminado"
                          onClick={() => setEditButtonColor('')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subsección de botones personalizados con links */}
                <div className="custom-buttons-subgroup">
                  <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                    <label className="mb-0">
                      <i className="fas fa-link me-1 text-warning" />
                      Botones Adicionales (Enlaces Web)
                    </label>
                    <button
                      type="button"
                      className="btn-add-custom-link"
                      onClick={() => handleAddCustomButton(true)}
                    >
                      <i className="fas fa-plus me-1" />
                      Añadir Botón
                    </button>
                  </div>

                  {editCustomButtons.length === 0 ? (
                    <div className="custom-buttons-empty">
                      Sin botones de enlace adicionales. Haz clic en "+ Añadir Botón" para agregar botones personalizados.
                    </div>
                  ) : (
                    <div className="custom-buttons-list">
                      {editCustomButtons.map((btn, index) => (
                        <div key={btn.id} className="custom-btn-item-row">
                          <div className="btn-row-fields">
                            <div className="field-label-group">
                              <span className="field-num">#{index + 1}</span>
                              <input
                                type="text"
                                placeholder="Texto (ej. Discord, VTT)"
                                value={btn.label}
                                onChange={(e) =>
                                  handleUpdateCustomButton(btn.id, 'label', e.target.value, true)
                                }
                                className="input-btn-label"
                              />
                            </div>

                            <input
                              type="url"
                              placeholder="Enlace URL (https://...)"
                              value={btn.url}
                              onChange={(e) =>
                                handleUpdateCustomButton(btn.id, 'url', e.target.value, true)
                              }
                              className="input-btn-url"
                            />

                            <div className="color-field-inline" title="Color específico para este botón">
                              <input
                                type="color"
                                className="color-picker-input-small"
                                value={btn.color || editButtonColor || '#ea580c'}
                                onChange={(e) =>
                                  handleUpdateCustomButton(btn.id, 'color', e.target.value, true)
                                }
                              />
                              <input
                                type="text"
                                placeholder="Color"
                                value={btn.color || ''}
                                onChange={(e) =>
                                  handleUpdateCustomButton(btn.id, 'color', e.target.value, true)
                                }
                                className="input-btn-color-text"
                              />
                            </div>

                            <button
                              type="button"
                              className="btn-remove-custom-item"
                              title="Eliminar este botón"
                              onClick={() => handleRemoveCustomButton(btn.id, true)}
                            >
                              <i className="fas fa-trash-can" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              </div>

              <div className="modal-actions-cyber">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  <i className="fas fa-check me-1" />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
