import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsDiagnostics } from '../../src/app/PhysicsDiagnostics.js';
import { EngineAdapter } from '../../src/simulation/EngineAdapter.js';
import { createParams } from '../../src/index.js';

class FakeElement {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.textContent='';}
  append(...items){this.children.push(...items);}
  appendChild(item){this.children.push(item);return item;}
  setAttribute(){}
  remove(){this.removed=true;}
  replaceChildren(...items){this.children=[...items];}
}
class FakeDocument { createElement(tag){return new FakeElement(tag);} }

test('3N.2-D1 — la ficha derecha muestra parámetros y diagnósticos L del estado físico', () => {
  const document = new FakeDocument(); const mount = new FakeElement('main');
  const diagnostics = new PhysicsDiagnostics({document,mount});
  const engine = EngineAdapter.create({mode:'VerticalBearing',params:createParams({s0:40}),theta0:0,Omega0:[0,0,0]});
  const state = engine.getState(); const shown = diagnostics.update(state);
  assert.equal(shown.Ia, state.params.Ia);
  assert.deepEqual(shown.LWheel, state.L_wheel_world);
  assert.deepEqual(shown.LBody, state.L_body_world);
  assert.ok(Math.abs(shown.LWheelMagnitude - Math.hypot(...state.L_wheel_world)) < 1e-12);
  assert.ok(Math.abs(shown.LBodyMagnitude - Math.hypot(...state.L_body_world)) < 1e-12);
  const text = diagnostics.parameters.children.map(x => x.children?.map(child => child.textContent).join(' ') ?? x.textContent).join(' ');
  assert.match(text,/Velocidad angular/); assert.match(text,/I =/); assert.match(text,/L — rueda/); assert.match(text,/L — humano/);
  assert.match(text,/x:/); assert.match(text,/y:/); assert.match(text,/z:/);
  assert.doesNotMatch(text,/\d{5,}/);
  assert.doesNotMatch(text,/L_total|Omega_w|n_w|omega_spin/);
});

test('3N.2-D2 — ω, I y L de la ficha salen directamente del snapshot físico', () => {
  const document = new FakeDocument(); const mount = new FakeElement('main');
  const diagnostics = new PhysicsDiagnostics({document,mount});
  const engine = EngineAdapter.create({mode:'VerticalBearing',params:createParams({s0:40}),theta0:0,Omega0:[0,0,0]});
  const state = engine.setSpinRate(63); const shown = diagnostics.update(state);
  assert.equal(shown.omegaWheel,63); assert.equal(shown.Ia,state.params.Ia);
  assert.deepEqual(shown.LWheel,state.L_wheel_world); assert.deepEqual(shown.LBody,state.L_body_world);
  const text = diagnostics.parameters.children.map(x => x.children?.map(child => child.textContent).join(' ') ?? x.textContent).join(' ');
  assert.match(text,/63\.00 rad\/s/); assert.match(text,new RegExp(`I = ${state.params.Ia.toFixed(4)}`));
  assert.match(text,new RegExp(`x: ${state.L_wheel_world[0].toFixed(4)}`));
});

test('3N.2-D3 — el panel mantiene la velocidad angular y L del humano también en modo simplificado', () => {
  const document = new FakeDocument(); const mount = new FakeElement('main');
  const diagnostics = new PhysicsDiagnostics({document,mount});
  const engine = EngineAdapter.create({mode:'VerticalBearing',params:createParams({s0:40}),theta0:0,Omega0:[0,0,0]});
  const state = engine.setIncludeHuman(false); diagnostics.update(state);
  const text = diagnostics.parameters.children.map(x => x.children?.map(child => child.textContent).join(' ') ?? x.textContent).join(' ');
  assert.match(text,/Velocidad angular del humano/);
  assert.match(text,/L — humano/);
});
