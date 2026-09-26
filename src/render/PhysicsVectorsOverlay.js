/** Presentation-only physical vector overlay. */
class PhysicsVectorsOverlay {
  constructor({ three, document: doc = globalThis.document, vectorScale = 0.055, humanVectorVisualScale = 0.30, minLength = 0.35, maxLength = 2.0 } = {}) {
    if (!three || typeof three !== 'object') throw new TypeError('three is required');
    const { Group, ArrowHelper, Vector3 } = three;
    if ([Group, ArrowHelper, Vector3].some(type => typeof type !== 'function')) throw new TypeError('three lacks vector constructors');
    this.three = three;
    this.document = doc;
    this.vectorScale = vectorScale;
    this.humanVectorVisualScale = humanVectorVisualScale;
    this.minLength = minLength;
    this.maxLength = maxLength;
    this.object = new Group();
    this.arrows = new Map();
    this.labels = new Map();
    this.visible = false;
    for (const [key, label] of [
      ['wheelOmega', 'ω — rueda'],
      ['wheelL', '𝑳 — rueda'],
      ['bodyOmega', 'ω — humano'],
      ['bodyL', '𝑳 — humano']
    ]) this._addArrow(key, label);
    this.setVisible(false);
  }

  _addArrow(key, label) {
    const arrow = new this.three.ArrowHelper(
      new this.three.Vector3(1,0,0),
      new this.three.Vector3(0,0,0),
      this.minLength,
      0x222222,
      0.16,
      0.10
    );
    arrow.visible = false;
    this.object.add(arrow);
    this.arrows.set(key, arrow);
    this._addLabel(key, label);
  }

  update(state, visualState) {
    if (!state || !visualState) return;
    const q = state.q;
    const wheelOrigin = visualState.wheelPosition ?? {x:0,y:0,z:0};
    const bodyOrigin = visualState.personPosition ?? {x:0,y:0.9,z:0};

    const omegaWheelWorld = state.Omega_w;
    const omegaBodyWorld = this._rotateByQ(state.Omega_b, q);
    const LwheelBody = state.L_wheel_body ?? state.L_wheel;
    const LbodyBody = state.L_body_body ?? state.L_body;
    const LwheelWorld = this._rotateByQ(LwheelBody, q);
    const LbodyWorld = this._rotateByQ(LbodyBody, q);

    const entries = [
      ['wheelOmega', this._toVisual(omegaWheelWorld), wheelOrigin, true, this.vectorScale],
      ['wheelL', this._toVisual(LwheelWorld), wheelOrigin, true, this.vectorScale],
      ['bodyOmega', this._toVisual(omegaBodyWorld), bodyOrigin, this._norm(omegaBodyWorld) > 1e-12, this.humanVectorVisualScale],
      ['bodyL', this._toVisual(LbodyWorld), bodyOrigin, this._norm(LbodyWorld) > 1e-12, this.humanVectorVisualScale]
    ];
    for (const [key, vector, origin, visible, scale] of entries) this._updateArrow(key, vector, origin, visible, scale);
  }

  _updateArrow(key, vector, origin, shouldShow, visualScale = this.vectorScale) {
    const arrow = this.arrows.get(key);
    if (!arrow) return;
    const mag = this._norm(vector);
    arrow.position.set(origin.x, origin.y, origin.z);
    if (!shouldShow || mag < 1e-12) {
      arrow.visible = false;
      const label = this.labels.get(key);
      if (label) label.visible = false;
      return;
    }
    arrow.visible = true;
    const label = this.labels.get(key);
    if (label) label.visible = true;
    const dir = new this.three.Vector3(vector[0]/mag, vector[1]/mag, vector[2]/mag);
    const length = Math.max(this.minLength, Math.min(this.maxLength, mag * visualScale));
    arrow.setDirection(dir);
    arrow.setLength(length, Math.min(0.18,length*0.24), Math.min(0.10,length*0.14));
    if (label) label.position.set(origin.x+dir.x*length, origin.y+dir.y*length, origin.z+dir.z*length);
  }

  _addLabel(key, text) {
    if (!this.three.Sprite || !this.three.SpriteMaterial || !this.three.CanvasTexture || !this.document) return;
    // Render the label from a higher-resolution canvas, then use a smaller
    // world-space sprite.  This improves glyph sampling without making the
    // physical vector or arrow any larger.
    const resolutionScale = 3;
    const canvas = this.document.createElement('canvas');
    canvas.width = 300 * resolutionScale;
    canvas.height = 52 * resolutionScale;
    const ctx = canvas.getContext?.('2d'); if (!ctx) return;
    ctx.setTransform?.(resolutionScale, 0, 0, resolutionScale, 0, 0);
    ctx.font = 'bold 21px sans-serif';
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 5, 32);
    const texture = new this.three.CanvasTexture(canvas);
    if ('minFilter' in texture && this.three.LinearFilter !== undefined) texture.minFilter = this.three.LinearFilter;
    if ('magFilter' in texture && this.three.LinearFilter !== undefined) texture.magFilter = this.three.LinearFilter;
    texture.needsUpdate = true;
    const sprite = new this.three.Sprite(new this.three.SpriteMaterial({map:texture,transparent:true}));
    sprite.scale.set(1.15,0.20,1);
    sprite.visible=false;
    this.object.add(sprite);
    this.labels.set(key,sprite);
  }

  _rotateByQ(vector,q){
    const [w,x,y,z]=q; const v=[0,...vector]; const qc=[w,-x,-y,-z];
    const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
    return mul(mul(q,v),qc).slice(1);
  }
  _toVisual(v){return [v[1],v[2],v[0]];}
  _norm(v){return Math.hypot(v[0],v[1],v[2]);}
  setVisible(visible){this.visible=Boolean(visible);this.object.visible=this.visible;}
  dispose(){for(const sprite of this.labels.values()) sprite.material?.map?.dispose?.(); this.object.clear?.();}
}

export { PhysicsVectorsOverlay };
export default PhysicsVectorsOverlay;
