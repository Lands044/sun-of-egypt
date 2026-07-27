import p5 from 'p5';

class ConfettiAnimation {
	constructor(container) {
		this.container = container;
		this.canvasContainer = null;
		this.p5Instance = null;
		this.init();
	}

	init() {
		// Создаем контейнер для canvas
		this.canvasContainer = document.createElement('div');
		this.canvasContainer.className = 'confetti-canvas';
		this.container.appendChild(this.canvasContainer);

		// Инициализируем p5.js
		this.p5Instance = new p5((p) => {
			let confettis;

			const themeCouleur = [
				'#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
				'#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50',
				'#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
				'#FF5722'
			];

			class Particule {
				constructor(parent) {
					this.parent = parent;
					this.gravite = parent.gravite;
					this.reinit();
					this.forme = p.round(p.random(0, 1));
					this.etape = 0;
				}

				reinit() {
					this.position = this.parent.position.copy();
					this.position.y = p.random(-p.height * 0.025, -p.height * 0.125);
					this.position.x = p.random(0, p.width);
					this.velocite = p.createVector(
						p.random(-p.width * 0.004, p.width * 0.004),
						p.random(-p.height * 0.0125, p.height * 0.0025)
					);
					this.friction = p.random(0.995, 0.98);
					// розмір відносний до ширини вікна — не залежить від zoom
					this.taille = p.round(p.random(p.width * 0.004, p.width * 0.012));
					this.moitie = this.taille / 2;
					this.couleur = p.color(p.random(themeCouleur));
				}

				dessiner() {
					this.etape = 0.5 + Math.sin(this.velocite.y * 20) * 0.5;

					p.translate(this.position.x, this.position.y);
					p.rotate(this.velocite.x * 2);
					p.scale(1, this.etape);
					p.noStroke();
					p.fill(this.couleur);

					if (this.forme === 0) {
						p.rect(-this.moitie, -this.moitie, this.taille, this.taille);
					} else {
						p.ellipse(0, 0, this.taille, this.taille);
					}

					p.resetMatrix();
				}

				integration() {
					this.velocite.add(this.gravite);
					this.velocite.mult(this.friction);
					this.position.add(this.velocite);

					if (this.position.y > p.height) {
						this.reinit();
					}
					if (this.position.x < 0) {
						this.reinit();
					}
					if (this.position.x > p.width + 10) {
						this.reinit();
					}
				}

				rendu() {
					this.integration();
					this.dessiner();
				}
			}

			class SystemeDeParticules {
				constructor(nombreMax, position) {
					this.position = position.copy();
					this.nombreMax = nombreMax;
					this.gravite = p.createVector(0, p.height * 0.000125);
					this.friction = 0.98;
					this.particules = [];

					for (let i = 0; i < this.nombreMax; i++) {
						this.particules.push(new Particule(this));
					}
				}

				rendu() {
					this.particules.forEach(particule => particule.rendu());
				}
			}

			p.setup = () => {
				p.createCanvas(p.windowWidth, p.windowHeight);
				p.frameRate(60);
				confettis = new SystemeDeParticules(500, p.createVector(p.width / 2, -20));
			};

			p.draw = () => {
				p.clear();
				confettis.rendu();
			};

			p.windowResized = () => {
				p.resizeCanvas(p.windowWidth, p.windowHeight);
				confettis.position = p.createVector(p.width / 2, -40);
			};
		}, this.canvasContainer);
	}

	destroy() {
		if (this.p5Instance) {
			this.p5Instance.remove();
			this.p5Instance = null;
		}
		if (this.canvasContainer) {
			this.canvasContainer.remove();
			this.canvasContainer = null;
		}
	}
}

export default ConfettiAnimation;
