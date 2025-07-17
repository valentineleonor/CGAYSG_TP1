let caminantes = [];
let mic, pitch;
let audioContext;

let gestorAmp;
let gestorPitch;
let monitorear = false;

let FREC_MIN = 100;
let FREC_MAX = 2000;

const FREC_AGUDA = 1500;
const FREC_GRAVE = 350;
const AMP_UMBRAL = 0.07;

let altoGestor = 100;
let anchoGestor = 400;

const NUM_CAMINANTES = 15;
const TAM = 7;
const SEPARACION = TAM + 2;
const model_url =
  "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/";

let lider = {
  x: 0,
  y: 0,
  dir: 0,
  vel: 2,
  dirObjetivo: 0,
};

let reordenando = false;
let espejo = false;
let girando = false;
let reordenVel = 0.05;

let margenBorde = 50;
let deteccionBordesActiva = false;

let canvasLado = 600;

function setup() {
  canvasLado = min(windowWidth, windowHeight);
  createCanvas(canvasLado, canvasLado);
  background("#f3e6d5");

  audioContext = getAudioContext();
  mic = new p5.AudioIn();
  mic.start(startPitch);
  userStartAudio();

  gestorAmp = new GestorSenial(0.01, 0.4);
  gestorPitch = new GestorSenial(FREC_MIN, FREC_MAX);

  lider.x = 0;
  lider.y = canvasLado / 2;
  lider.dir = 0;
  lider.dirObjetivo = 0;

  let startOffset = -((NUM_CAMINANTES - 1) * SEPARACION) / 2;
  for (let i = 0; i < NUM_CAMINANTES; i++) {
    let offsetY = startOffset + i * SEPARACION;
    let color = colorPorIndice(i);
    caminantes.push(new Caminante(offsetY, color));
  }

  setTimeout(() => {
    deteccionBordesActiva = true;
  }, 3000);
}

function draw() {
  let amp = mic.getLevel();
  gestorAmp.actualizar(amp);
  gestorPitch.actualizar(pitch);

 

  let diff = (lider.dirObjetivo - lider.dir + 360) % 360;
  if (diff > 180) diff -= 360;
  lider.dir += diff * 0.05;
  if (abs(diff) < 0.5) girando = false;

  lider.x += lider.vel * cos(radians(lider.dir));
  lider.y += lider.vel * sin(radians(lider.dir));

  if (deteccionBordesActiva) {
    if (
      lider.x < margenBorde ||
      lider.x > width + 250 ||
      lider.y < margenBorde ||
      lider.y > height - margenBorde
    ) {
      let anguloCentro = degrees(
        atan2(height / 2 - lider.y, width / 2 - lider.x)
      );
      lider.dirObjetivo = (anguloCentro + 360) % 360;
      girando = true;
    }
  }

  if (lider.x > width) {
    resetSimulacion();
    return;
  }

  for (let c of caminantes) {
    c.actualizar(lider.x, lider.y, lider.dir);
    c.dibujar();
  }

  if (!reordenando && amp > AMP_UMBRAL) {
    iniciarReordenamiento();
  }

  if (reordenando) {
    let completado = true;
    for (let c of caminantes) {
      if (!c.actualizarOffset()) completado = false;
    }
    if (completado) reordenando = false;
  }

  if (monitorear) {
    gestorAmp.dibujar(50, 50);
    gestorPitch.dibujar(50, 200);
  }
}

function iniciarReordenamiento() {
  reordenando = true;
  espejo = !espejo;

  let startOffset = -((NUM_CAMINANTES - 1) * SEPARACION) / 2;
  let orden = [];
  for (let i = 0; i < NUM_CAMINANTES; i++) {
    orden.push(startOffset + i * SEPARACION);
  }

  if (espejo) orden.reverse();

  for (let i = 0; i < caminantes.length; i++) {
    caminantes[i].offsetObjetivo = orden[i];
  }
}

function startPitch() {
  pitch = ml5.pitchDetection(model_url, audioContext, mic.stream, modelLoaded);
}

function modelLoaded() {
  getPitch();
}

function getPitch() {
  pitch.getPitch(function (err, frequency) {
    console.log("Amplitud:", mic.getLevel());
    if (!frequency || girando) {
      getPitch();
      return;
    }

    // Ignorar variaciones bruscas
    let deltaFrec = abs(
      frequency - (gestorPitch.filtrada * (FREC_MAX - FREC_MIN) + FREC_MIN)
    );
    if (deltaFrec > 150) {
      getPitch();
      return;
    }

    gestorPitch.actualizar(frequency);

    let giros = [90, 135, 180];
    let angulo = random(giros);

    if (frequency > FREC_AGUDA) {
      lider.dirObjetivo = (lider.dir + angulo) % 360;
      girando = true;
    } else if (frequency < FREC_GRAVE) {
      lider.dirObjetivo = (lider.dir - angulo + 360) % 360;
      girando = true;
    }

    getPitch();
  });
}

function resetSimulacion() {
  background("#f3e6d5");

  lider.x = 0;
  lider.y = canvasLado / 2;
  lider.dir = 0;
  lider.dirObjetivo = 0;

  caminantes = [];
  let startOffset = -((NUM_CAMINANTES - 1) * SEPARACION) / 2;
  for (let i = 0; i < NUM_CAMINANTES; i++) {
    let offsetY = startOffset + i * SEPARACION;
    let color = colorPorIndice(i);
    caminantes.push(new Caminante(offsetY, color));
  }

  reordenando = false;
  espejo = false;
  girando = false;

  deteccionBordesActiva = false;
  setTimeout(() => {
    deteccionBordesActiva = true;
  }, 3000);
}

class Caminante {
  constructor(offsetY, col) {
    this.offsetY = offsetY;
    this.offsetObjetivo = offsetY;
    this.x = 0;
    this.y = 0;
    this.dir = 0;
    this.color = col;
  }

  actualizar(baseX, baseY, dir) {
    this.dir = dir;
    let angle = radians(dir + 90);
    this.x = baseX + this.offsetY * cos(angle);
    this.y = baseY + this.offsetY * sin(angle);
  }

  actualizarOffset() {
    let delta = this.offsetObjetivo - this.offsetY;
    if (abs(delta) > 0.1) {
      this.offsetY += delta * reordenVel;
      return false;
    } else {
      this.offsetY = this.offsetObjetivo;
      return true;
    }
  }

  dibujar() {
    push();
    translate(this.x, this.y);
    rotate(radians(this.dir));
    stroke(this.color);
    strokeWeight(12);
    line(0, -TAM / 2, 0, TAM / 2);
    pop();
  }
}

// Paleta colores
const PALETA_ARCOIRIS = [
  "#3f00a1",
  "#004dff",
  "#0080ff",
  "#00c8ff",
  "#00ff94",
  "#00ff2f",
  "#8dff00",
  "#f7ff00",
  "#ffcc00",
  "#ff9900",
  "#ff5300",
  "#ff0000",
  "#ff0066",
  "#d200ff",
  "#8000ff",
];

function colorPorIndice(i) {
  return color(PALETA_ARCOIRIS[i % PALETA_ARCOIRIS.length]);
}

class GestorSenial {
  constructor(minimo_, maximo_) {
    this.minimo = minimo_;
    this.maximo = maximo_;
    this.puntero = 0;
    this.cargado = 0;
    this.mapeada = [];
    this.filtrada = 0;
    this.anterior = 0;
    this.derivada = 0;
    this.histFiltrada = [];
    this.histDerivada = [];
    this.amplificadorDerivada = 15.0;
    this.dibujarDerivada = false;
    this.f = 0.8;
  }

  actualizar(entrada_) {
    this.mapeada[this.puntero] = map(
      entrada_,
      this.minimo,
      this.maximo,
      0.0,
      1.0
    );
    this.mapeada[this.puntero] = constrain(
      this.mapeada[this.puntero],
      0.0,
      1.0
    );
    this.filtrada =
      this.filtrada * this.f + this.mapeada[this.puntero] * (1 - this.f);
    this.histFiltrada[this.puntero] = this.filtrada;
    this.derivada = (this.filtrada - this.anterior) * this.amplificadorDerivada;
    this.histDerivada[this.puntero] = this.derivada;
    this.anterior = this.filtrada;

    this.puntero++;
    if (this.puntero >= anchoGestor) this.puntero = 0;
    this.cargado = max(this.cargado, this.puntero);
  }

  dibujar(x_, y_) {
    push();
    fill(0);
    stroke(255);
    rect(x_, y_, anchoGestor, altoGestor);

    for (let i = 1; i < this.cargado; i++) {
      let altura1 = map(this.mapeada[i - 1], 0.0, 1.0, y_ + altoGestor, y_);
      let altura2 = map(this.mapeada[i], 0.0, 1.0, y_ + altoGestor, y_);
      stroke(255);
      line(x_ + i - 1, altura1, x_ + i, altura2);

      altura1 = map(this.histFiltrada[i - 1], 0.0, 1.0, y_ + altoGestor, y_);
      altura2 = map(this.histFiltrada[i], 0.0, 1.0, y_ + altoGestor, y_);
      stroke(0, 255, 0);
      line(x_ + i - 1, altura1, x_ + i, altura2);

      if (this.dibujarDerivada) {
        altura1 = map(this.histDerivada[i - 1], -1.0, 1.0, y_ + altoGestor, y_);
        altura2 = map(this.histDerivada[i], -1.0, 1.0, y_ + altoGestor, y_);
        stroke(255, 255, 0);
        line(x_ + i - 1, altura1, x_ + i, altura2);
      }
    }
    stroke(255, 0, 0);
    line(x_ + this.puntero, y_, x_ + this.puntero, y_ + altoGestor);
    pop();
  }
}
