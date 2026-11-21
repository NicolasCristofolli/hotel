import { Crosshair, MousePointerClick, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { MapCanvas } from '../../components/MapCanvas';
import { defaultHotelConfig } from '../../config/defaultHotelConfig';
import { uid } from '../../lib/status';
import { useHotel } from '../../state/HotelContext';
import { useToast } from '../../state/ToastContext';
import type { MapPin } from '../../types';
import { Card, Field, Input, Segmented, Textarea } from '../ui';

type Mode = 'move' | 'add';

export function MapEditorTab() {
  const { config, setConfig } = useHotel();
  const toast = useToast();
  const pins = [...config.pins].sort((a, b) => a.number - b.number);
  const [selectedId, setSelectedId] = useState<string | null>(pins[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>('move');
  const selected = pins.find((p) => p.id === selectedId);

  const savePins = (fn: (l: MapPin[]) => MapPin[]) => setConfig((p) => ({ ...p, pins: fn(p.pins) }));
  const update = (id: string, patch: Partial<MapPin>) => savePins((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const onCanvasClick = ({ x, y }: { x: number; y: number }) => {
    if (mode === 'add') {
      const id = uid();
      const number = Math.max(0, ...config.pins.map((p) => p.number)) + 1;
      savePins((l) => [
        ...l,
        {
          id,
          number,
          name: `Novo ponto ${number}`,
          category: 'Lazer',
          x,
          y,
          hours: 'Livre',
          description: 'Descreva este ponto de interesse.',
          image: defaultHotelConfig.identity.heroImage,
        },
      ]);
      setSelectedId(id);
      setMode('move');
      toast(`Ponto ${number} adicionado`, `Posição ${x}% × ${y}%`);
    } else if (selected) {
      update(selected.id, { x, y });
    } else {
      toast('Selecione um ponto', 'Escolha um pino na lista ou no mapa');
    }
  };

  const remove = (pin: MapPin) => {
    if (!confirm(`Excluir o ponto ${pin.number} — ${pin.name}?`)) return;
    savePins((l) =>
      l
        .filter((p) => p.id !== pin.id)
        .sort((a, b) => a.number - b.number)
        .map((p, i) => ({ ...p, number: i + 1 })),
    );
    setSelectedId(null);
    toast('Ponto excluído', 'Numeração reorganizada');
  };

  const restore = () => {
    if (!confirm('Restaurar mapa e pontos de interesse para o padrão?')) return;
    setConfig((p) => ({ ...p, pins: defaultHotelConfig.pins, mapImage: defaultHotelConfig.mapImage }));
    setSelectedId(defaultHotelConfig.pins[0].id);
    toast('Mapa restaurado', 'Dados padrão aplicados');
  };

  return (
    <div className="a-map-layout">
      <Card
        title="Mapa do resort"
        desc={
          mode === 'add'
            ? 'Clique no mapa para adicionar um novo ponto.'
            : selected
              ? `Clique no mapa para reposicionar o ponto ${selected.number}.`
              : 'Selecione um ponto para movê-lo.'
        }
        actions={
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'move', label: 'Mover' },
              { value: 'add', label: '+ Adicionar' },
            ]}
          />
        }
      >
        <div className={`a-map ${mode === 'add' ? 'is-adding' : ''}`}>
          <MapCanvas
            pins={pins}
            image={config.mapImage}
            selectedId={selectedId}
            onPinClick={(p) => {
              setSelectedId(p.id);
              setMode('move');
            }}
            onCanvasClick={onCanvasClick}
            editable
          />
        </div>
        <div className="a-map-meta">
          <span>
            {mode === 'add' ? <Plus size={14} /> : <Crosshair size={14} />}
            {selected ? `Ponto ${selected.number}: x ${selected.x}% • y ${selected.y}%` : 'Nenhum ponto selecionado'}
          </span>
          <button className="a-btn a-btn-outline" onClick={restore}>
            <RotateCcw size={16} /> Restaurar Dados Padrão
          </button>
        </div>
        <Field label="Imagem do mapa (URL)" hint="Deixe em branco para usar o mapa ilustrado (adapta-se à paleta de cores)." wide>
          <Input value={config.mapImage} placeholder="https://…" onChange={(e) => setConfig((p) => ({ ...p, mapImage: e.target.value }))} />
        </Field>
      </Card>

      <div className="a-stack">
        <Card title="Pontos de interesse" desc={`${pins.length} pontos`}>
          <div className="a-pin-list">
            {pins.map((p) => (
              <button key={p.id} className={`a-pin-item ${p.id === selectedId ? 'on' : ''}`} onClick={() => setSelectedId(p.id)}>
                <span className="a-pin-num">{p.number}</span>
                <span className="a-pin-name">{p.name}</span>
              </button>
            ))}
          </div>
        </Card>

        {selected ? (
          <Card
            title={`Ponto ${selected.number}`}
            actions={
              <button className="a-icon-btn danger" onClick={() => remove(selected)} aria-label="Excluir ponto">
                <Trash2 size={16} />
              </button>
            }
          >
            <div className="a-form">
              <Field label="Nome" wide>
                <Input value={selected.name} onChange={(e) => update(selected.id, { name: e.target.value })} />
              </Field>
              <Field label="Categoria">
                <Input value={selected.category} onChange={(e) => update(selected.id, { category: e.target.value })} />
              </Field>
              <Field label="Horário">
                <Input value={selected.hours} onChange={(e) => update(selected.id, { hours: e.target.value })} />
              </Field>
              <Field label="X (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={selected.x}
                  onChange={(e) => update(selected.id, { x: Number(e.target.value) })}
                />
              </Field>
              <Field label="Y (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={selected.y}
                  onChange={(e) => update(selected.id, { y: Number(e.target.value) })}
                />
              </Field>
              <Field label="Descrição" wide>
                <Textarea value={selected.description} onChange={(e) => update(selected.id, { description: e.target.value })} />
              </Field>
              <Field label="Foto (URL)" wide>
                <Input value={selected.image} onChange={(e) => update(selected.id, { image: e.target.value })} />
              </Field>
              <Field label='Destino do "Ver Detalhes"' hint="Ex.: servicos/restaurante, experience/spa, programacao" wide>
                <Input
                  value={selected.detailRoute ?? ''}
                  onChange={(e) => update(selected.id, { detailRoute: e.target.value || undefined })}
                />
              </Field>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="a-empty">
              <MousePointerClick size={20} /> Selecione um ponto no mapa ou na lista.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
