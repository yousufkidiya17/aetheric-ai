/**
 * AETHERIC PARTICLE SYSTEM
 * Interactive floating dots with mouse repulsion — like Antigravity's website
 */

(function() {
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let particles = [];
  const particleCount = 100;
  const mouse = { x: -1000, y: -1000, radius: 150 };
  const connectionDistance = 120;

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('touchstart', e => {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
  });
  window.addEventListener('touchmove', e => {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
  });
  window.addEventListener('touchend', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();
  }

  class Particle {
    constructor() {
      this.init();
    }

    init() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 2 + 1;
      this.baseX = this.x;
      this.baseY = this.y;
      this.density = (Math.random() * 30) + 1;
      this.color = `rgba(99, 102, 241, ${Math.random() * 0.4 + 0.1})`;
      this.vx = Math.random() * 0.5 - 0.25;
      this.vy = Math.random() * 0.5 - 0.25;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 5;
      ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
      ctx.fill();
    }

    update() {
      // Self movement
      this.baseX += this.vx;
      this.baseY += this.vy;

      // Boundary wrap for base position
      if (this.baseX < 0) this.baseX = canvas.width;
      if (this.baseX > canvas.width) this.baseX = 0;
      if (this.baseY < 0) this.baseY = canvas.height;
      if (this.baseY > canvas.height) this.baseY = 0;

      // Mouse interaction — repel particles
      let dx = mouse.x - this.x;
      let dy = mouse.y - this.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      let forceDirectionX = dx / distance;
      let forceDirectionY = dy / distance;
      let maxDistance = mouse.radius;
      let force = (maxDistance - distance) / maxDistance;
      let directionX = forceDirectionX * force * this.density;
      let directionY = forceDirectionY * force * this.density;

      if (distance < mouse.radius) {
        this.x -= directionX;
        this.y -= directionY;
      } else {
        if (this.x !== this.baseX) {
          let dx2 = this.x - this.baseX;
          this.x -= dx2 / 20;
        }
        if (this.y !== this.baseY) {
          let dy2 = this.y - this.baseY;
          this.y -= dy2 / 20;
        }
      }
    }
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < connectionDistance) {
          const opacity = (1 - dist / connectionDistance) * 0.15;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
          ctx.lineWidth = 0.6;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.shadowBlur = 0; // Reset shadow before connections
    drawConnections();
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }
    requestAnimationFrame(animate);
  }

  resizeCanvas();
  animate();
})();
