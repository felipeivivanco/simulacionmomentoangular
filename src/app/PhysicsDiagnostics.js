/**
 * Student-facing physical diagnostics.
 * All displayed quantities come directly from one engine snapshot. The
 * The panel uses the world frame, matching the physical vector overlay.
 */
class PhysicsDiagnostics {
  constructor({ document, mount, mode = 'VerticalBearing' } = {}) {
    if (!document || typeof document.createElement !== 'function') throw new TypeError('document is required');
    if (!mount || typeof mount.appendChild !== 'function') throw new TypeError('mount must provide appendChild()');
    this.document = document;
    this.mount = mount;
    this.disposed = false;
    this._humanYTooltips = [];
    this.mode = mode;

    this.root = document.createElement('aside');
    this.root.className = 'ui-panel ui-diagnostics';
    this.root.setAttribute?.('aria-label', 'Parámetros');

    const header = document.createElement('div');
    header.className = 'ui-diagnostic-header';
    const icon = document.createElement('span');
    icon.className = 'ui-diagnostic-icon';
    icon.textContent = '⚙';
    this.title = document.createElement('div');
    this.title.className = 'ui-diagnostic-title';
    this.title.textContent = 'Parámetros';
    header.append(icon, this.title);
    this.root.appendChild(header);

    this.parameters = document.createElement('div');
    this.root.appendChild(this.parameters);
    mount.appendChild(this.root);
  }

  _line(label, value) {
    const wrapper = this.document.createElement('div');
    wrapper.className = 'ui-diagnostic-line';
    const heading = this.document.createElement('div');
    heading.textContent = label;
    heading.className = 'ui-diagnostic-label';
    const valueNode = this.document.createElement('div');
    valueNode.className = 'ui-diagnostic-value';
    valueNode.textContent = value;
    wrapper.append(heading, valueNode);
    return wrapper;
  }

  _vectorBlock(title, vector) {
    const wrapper = this.document.createElement('section');
    wrapper.className = 'ui-vector-card';
    const heading = this.document.createElement('div');
    heading.className = 'ui-vector-title';
    heading.textContent = title;
    const magnitude = this._norm(vector);
    const magnitudeNode = this.document.createElement('div');
    magnitudeNode.className = 'ui-vector-mag';
    magnitudeNode.textContent = `|L| = ${magnitude.toFixed(4)} kg·m²/s`;
    const components = [];
    for (const [axis, value] of [['x', vector[0]], ['y', vector[1]], ['z', vector[2]]]) {
      const row = this.document.createElement('div');
      row.textContent = `${axis}: ${value.toFixed(4)}`;
      row.className = 'ui-vector-row' + (axis === 'y' && title === 'L — humano' ? ' ui-vector-row--y' : '');
      if (this.mode !== 'Free' && title === 'L — humano' && axis === 'y') this._addHumanYHelp(row, value);
      components.push(row);
    }
    wrapper.append(heading, magnitudeNode, ...components);
    return wrapper;
  }

  update(state) {
    if (this.disposed) throw new Error('PhysicsDiagnostics is disposed');
    if (!state || !state.params || !Number.isFinite(state.theta) || !Array.isArray(state.Omega_b) || state.Omega_b.length !== 3 || !state.Omega_b.every(Number.isFinite) || !Array.isArray(state.Omega_w) || !Array.isArray(state.n_w)) {
      throw new TypeError('physics snapshot must contain params, theta, Omega_w and n_w');
    }
    const physicalOmegaWheel = this._dot(state.Omega_w, state.n_w);
    // The two UI panels intentionally share the configured wheel-speed value
    // from the same engine snapshot. The physical dot product remains audited
    // separately and is exposed as physicalOmegaWheel; it is not a second UI
    // source for the displayed control value.
    const omegaWheel = state.params.s0;
    // The overlay draws world-frame vectors, so the student-facing component
    // values use the same frame. This keeps panel X/Y/Z numerically identical
    // to the colored physical arrows.
    const LWheel = state.L_wheel_world ?? state.L_wheel_body ?? state.L_wheel;
    const LBody = state.L_body_world ?? state.L_body_body ?? state.L_body;
    if (!Array.isArray(LWheel) || LWheel.length !== 3 || !LWheel.every(Number.isFinite) ||
        !Array.isArray(LBody) || LBody.length !== 3 || !LBody.every(Number.isFinite)) {
      throw new TypeError('physics snapshot must contain wheel and body angular momentum vectors');
    }

    this._clearHumanYTooltips();
    this._replace(this.parameters, [
      this._line('Velocidad angular de la rueda', `ω = ${omegaWheel.toFixed(2)} rad/s`),
      this._line('Velocidad angular del humano', `${this._norm(state.Omega_b).toFixed(3)} rad/s`),
      this._line('Diámetro de la rueda', `D = ${state.params.D.toFixed(2)} m`),
      this._line('Masa de la rueda', `m = ${state.params.m_w.toFixed(2)} kg`),
      this._line('Ángulo del eje', `θ = ${this._deg(state.theta).toFixed(1)}°`),
      this._line('Momento de inercia de la rueda', `I = ${state.params.Ia.toFixed(4)} kg·m²`),
      this._vectorBlock('L — rueda', LWheel),
      this._vectorBlock('L — humano', LBody)
    ]);

    return this.getState(state, omegaWheel, physicalOmegaWheel);
  }

  getState(state, omega = state.params.s0, physicalOmega = this._dot(state.Omega_w, state.n_w)) {
    const wheel = state.L_wheel_world ?? state.L_wheel_body ?? state.L_wheel;
    const body = state.L_body_world ?? state.L_body_body ?? state.L_body;
    const LWheel = Array.isArray(wheel) ? [...wheel] : undefined;
    const LBody = Array.isArray(body) ? [...body] : undefined;
    return {
      omegaWheel: omega,
      physicalOmegaWheel: physicalOmega,
      omegaHuman: Array.isArray(state.Omega_b) ? this._norm(state.Omega_b) : undefined,
      Ia: state.params.Ia,
      D: state.params.D,
      R: state.params.R,
      m_w: state.params.m_w,
      LWheel,
      LBody,
      LWheelMagnitude: LWheel ? this._norm(LWheel) : undefined,
      LBodyMagnitude: LBody ? this._norm(LBody) : undefined,
      frame: 'world'
    };
  }

  _addHumanYHelp(row, value) {
    const helpText = 'Las componentes X, Y y Z de este panel usan el marco mundial, igual que las flechas de colores del overlay. El acoplamiento antropomórfico se origina en el marco corporal (Iᵧ𝓏 ≠ 0) y, al transformar el vector al mundo, sus componentes pueden redistribuirse entre X, Y y Z. No significa que exista un giro independiente alrededor de cada eje.';
    row.setAttribute?.('aria-label', `Componente Y del momento angular humano: ${value.toFixed(4)}. Ayuda disponible en el signo de interrogación.`);
    row.style.position = 'relative';

    const help = this.document.createElement('button');
    help.type = 'button';
    help.textContent = '?';
    help.setAttribute?.('aria-label', 'Explicación de la componente Y de L humano');
    help.className = 'ui-help';
    Object.assign(help.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '17px',
      height: '17px',
      marginLeft: '6px',
      padding: '0',
      border: '1px solid rgba(0,0,0,0.28)',
      borderRadius: '50%',
      background: 'var(--ui-tooltip-bg, rgba(255,255,255,0.97))',
      color: 'var(--ui-tooltip-text, #173a63)',
      fontSize: '11px',
      fontWeight: '700',
      lineHeight: '1',
      cursor: 'help',
      verticalAlign: 'middle'
    });

    const tooltip = this.document.createElement('div');
    tooltip.textContent = helpText;
    tooltip.setAttribute?.('role', 'tooltip');
    tooltip.setAttribute?.('aria-hidden', 'true');
    Object.assign(tooltip.style, {
      display: 'none',
      position: 'fixed',
      zIndex: '1000',
      maxWidth: 'min(360px, calc(100vw - 32px))',
      padding: '10px 12px',
      boxSizing: 'border-box',
      borderRadius: '8px',
      border: '1px solid rgba(0,0,0,0.18)',
      background: 'rgba(255,255,255,0.97)',
      color: '#111',
      boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
      fontSize: '13px',
      lineHeight: '1.4',
      pointerEvents: 'none'
    });

    const show = () => {
      tooltip.style.display = 'block';
      tooltip.setAttribute?.('aria-hidden', 'false');
      const rect = help.getBoundingClientRect?.();
      if (rect) {
        tooltip.style.left = `${Math.max(8, Math.min(rect.left, (globalThis.innerWidth || 800) - 368))}px`;
        tooltip.style.top = `${Math.min((globalThis.innerHeight || 600) - 12, rect.bottom + 6)}px`;
      } else {
        tooltip.style.left = '16px';
        tooltip.style.top = '16px';
      }
    };
    const hide = () => {
      tooltip.style.display = 'none';
      tooltip.setAttribute?.('aria-hidden', 'true');
    };
    help.addEventListener?.('mouseenter', show);
    help.addEventListener?.('mouseleave', hide);
    help.addEventListener?.('focus', show);
    help.addEventListener?.('blur', hide);

    row.appendChild(help);
    const tooltipHost = this.mount.parentElement || this.mount;
    tooltipHost.appendChild(tooltip);
    this._humanYTooltips.push(tooltip);
    row._humanYHelp = { help, tooltip, show, hide };
  }

  _clearHumanYTooltips() {
    for (const tooltip of this._humanYTooltips) tooltip.remove?.();
    this._humanYTooltips = [];
  }

  _replace(container, children) {
    if (typeof container.replaceChildren === 'function') container.replaceChildren(...children);
    else { container.children = []; if (typeof container.append === 'function') container.append(...children); }
  }

  _dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  _norm(v) { return Math.hypot(v[0], v[1], v[2]); }
  _deg(rad) { return rad * 180 / Math.PI; }

  dispose() {
    if (this.disposed) return;
    this._clearHumanYTooltips();
    this.root.remove();
    this.disposed = true;
  }
}

export { PhysicsDiagnostics };
export default PhysicsDiagnostics;
