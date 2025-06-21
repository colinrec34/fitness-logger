// src/components/ParticlesBackground.tsx
import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import {
  type Container,
  type ISourceOptions,
} from "@tsparticles/engine";
import { loadSlim } from "@tsparticles/slim";

export default function ParticlesBackground() {
  const [init, setInit] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      setInit(true);
    });

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const particlesLoaded = async (container?: Container): Promise<void> => {
    console.log("Particles loaded", container);
  };

  const options: ISourceOptions = useMemo(
    () => ({
      background: {
        color: { value: "#1a1a1a" },
      },
      fpsLimit: 60,
      particles: {
        number: {
          value: isMobile ? 25 : 50,
          density: { enable: true, area: 800 },
        },
        color: { value: "#cbd5e1" },
        shape: { type: "circle" },
        opacity: {
          value: 0.6,
          animation: {
            enable: true,
            speed: 0.2,
            minimumValue: 0.3,
            sync: false,
          },
        },
        size: {
          value: { min: 1.5, max: 3 },
          random: true,
        },
        move: {
          enable: true,
          speed: 0.4,
          direction: "none",
          outModes: { default: "out" },
        },
        links: {
          enable: !isMobile,
          color: "#cbd5e1",
          distance: isMobile ? 90 : 140,
          opacity: 0.5,
          width: 1,
        },
      },
      detectRetina: true,
    }),
    [isMobile]
  );

  return init ? (
    <Particles
      id="tsparticles"
      particlesLoaded={particlesLoaded}
      options={options}
    />
  ) : null;
}
