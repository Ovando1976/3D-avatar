import { useMemo } from 'react';
import { HexColorPicker } from 'react-colorful';
import 'react-colorful/dist/index.css';
import PropTypes from 'prop-types';
import { useAvatarStore } from '../state/avatarStore.js';
import '../styles/panel.css';

const Slider = ({ id, label, min, max, step, value, onChange }) => (
  <label htmlFor={id} className="slider-control">
    <span>{label}</span>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(parseFloat(event.target.value))}
    />
    <output htmlFor={id}>{value.toFixed(2)}</output>
  </label>
);

Slider.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
  step: PropTypes.number,
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};

Slider.defaultProps = {
  min: 0,
  max: 1.5,
  step: 0.05,
};

const ColorControl = ({ label, colorKey, value }) => {
  const updateColor = useAvatarStore((state) => state.updateColor);

  return (
    <div className="color-control">
      <div className="color-header">
        <span>{label}</span>
        <span className="color-preview" style={{ backgroundColor: value }} />
      </div>
      <HexColorPicker color={value} onChange={(hex) => updateColor(colorKey, hex)} />
      <code>{value.toUpperCase()}</code>
    </div>
  );
};

ColorControl.propTypes = {
  label: PropTypes.string.isRequired,
  colorKey: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

const InterfacePanel = () => {
  const {
    skinTone,
    accent,
    accessory,
    keyLight,
    fillLight,
    rimLight,
    environment,
    setEnvironment,
    setBackground,
    applyTheme,
    defaultThemes,
    updateLight,
  } = useAvatarStore();

  const environmentOptions = useMemo(
    () => [
      { label: 'Sunset', value: 'sunset' },
      { label: 'Studio', value: 'studio' },
      { label: 'Night', value: 'night' },
      { label: 'Forest', value: 'forest' },
      { label: 'Warehouse', value: 'warehouse' },
    ],
    []
  );

  return (
    <aside className="interface-panel">
      <section>
        <h2>Quick themes</h2>
        <div className="theme-grid">
          {Object.entries(defaultThemes).map(([key, theme]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyTheme(key)}
              className="theme-card"
              aria-label={`Apply ${key} theme`}
            >
              <span className="theme-name">{key}</span>
              <span className="theme-swatches">
                <span style={{ backgroundColor: theme.skinTone }} />
                <span style={{ backgroundColor: theme.accent }} />
                <span style={{ backgroundColor: theme.accessory }} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Avatar colours</h2>
        <div className="panel-grid">
          <ColorControl label="Skin" colorKey="skinTone" value={skinTone} />
          <ColorControl label="Accent" colorKey="accent" value={accent} />
          <ColorControl label="Accessory" colorKey="accessory" value={accessory} />
        </div>
      </section>

      <section>
        <h2>Lighting</h2>
        <div className="light-controls">
          <Slider id="keyLight" label="Key" value={keyLight} onChange={(v) => updateLight('keyLight', v)} />
          <Slider id="fillLight" label="Fill" value={fillLight} onChange={(v) => updateLight('fillLight', v)} />
          <Slider id="rimLight" label="Rim" value={rimLight} onChange={(v) => updateLight('rimLight', v)} />
        </div>
      </section>

      <section>
        <h2>Environment</h2>
        <label className="select-control">
          <span>HDRI preset</span>
          <select value={environment.preset} onChange={(event) => setEnvironment(event.target.value)}>
            {environmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="background-picker">
          <span>Backdrop</span>
          <HexColorPicker color={environment.background} onChange={setBackground} />
          <code>{environment.background.toUpperCase()}</code>
        </div>
      </section>
    </aside>
  );
};

export default InterfacePanel;
