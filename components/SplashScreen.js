import { useEffect, useState, useRef } from "react";

/**
 * DSC Mobile — Cinematic Splash Screen (India Flag Premium Theme)
 *
 * Sequence (all CSS-driven, no libraries):
 *  0.0s – 0.5s  : Black screen, ambient glow builds
 *  0.5s – 1.5s  : D slides in from LEFT  + whoosh sound
 *  1.5s – 2.5s  : C slides in from RIGHT + whoosh sound
 *  2.5s – 3.5s  : S drops from TOP       + whoosh sound (premium glow on S)
 *  3.5s – 4.5s  : MOBILE rises from BOTTOM + whoosh sound
 *  4.5s – 5.2s  : All letters settle — soft impact flash + glow burst
 *  5.2s – 6.5s  : Hold the final logo, then fade-out entire overlay
 *  6.5s+        : Overlay unmounted, website visible as normal
 *
 * Color Palette — India Flag Inspired:
 *  Saffron:  #FF9933 / #FFB347 / #E68A2E
 *  White:    #FFFFFF / #F0F0F0 / #E8E8E8
 *  Green:    #138808 / #1AAF0D / #0D6B06
 *  Ashoka:   #000080 (deep royal blue — accent/highlights only)
 */
export default function SplashScreen({ onComplete }) {
  // Each letter enters in sequence; track phase via state
  const [phase, setPhase] = useState(0);
  // 0 = initial black
  // 1 = D entering
  // 2 = C entering
  // 3 = S entering
  // 4 = MOBILE entering
  // 5 = settled / glow burst
  // 6 = fading out
  // 7 = done (hidden)

  const audioCtx = useRef(null);

  // Build AudioContext lazily (browser blocks before user gesture, but
  // splash starts immediately so we attempt it)
  const playWhoosh = (type = "swoosh") => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      if (ctx.state === "suspended") ctx.resume();

      const bufLen = ctx.sampleRate * 0.35; // 350ms
      const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // White noise with exponential decay = whoosh/deshh
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2.5);
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      // Band-pass filter to shape the "deshh" timbre
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = type === "deep" ? 180 : 1400;
      filter.Q.value = 0.8;

      const gain = ctx.createGain();
      gain.gain.value = type === "deep" ? 0.55 : 0.35;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch (_) {
      // AudioContext blocked by browser policy — silently skip
    }
  };

  const playImpact = () => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      if (ctx.state === "suspended") ctx.resume();

      // Low-frequency thump
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (_) {}
  };

  useEffect(() => {
    // Phase timeline using setTimeout chain
    const timers = [];

    const t = (fn, ms) => {
      timers.push(setTimeout(fn, ms));
    };

    t(() => { setPhase(1); playWhoosh("swoosh"); }, 500);
    t(() => { setPhase(2); playWhoosh("swoosh"); }, 1500);
    t(() => { setPhase(3); playWhoosh("swoosh"); }, 2500);
    t(() => { setPhase(4); playWhoosh("deep");   }, 3500);
    t(() => { setPhase(5); playImpact();          }, 4600);
    t(() => { setPhase(6);                        }, 5400);
    t(() => { setPhase(7); onComplete?.();        }, 6800);

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 7) return null;

  const settled = phase >= 5;
  const fadingOut = phase >= 6;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at center, #080a04 0%, #000000 100%)",
        overflow: "hidden",
        opacity: fadingOut ? 0 : 1,
        transition: fadingOut ? "opacity 1.3s cubic-bezier(0.4,0,0.2,1)" : "none",
        pointerEvents: phase === 7 ? "none" : "all",
      }}
      aria-hidden="true"
    >
      {/* ── Ambient Background Particles / Grid ───────────────────────────── */}
      <div style={styles.ambientGrid} />

      {/* ── Saffron top ambient glow ──────────────────────────────────────── */}
      <div
        style={{
          ...styles.topAmbientGlow,
          opacity: phase >= 1 ? 0.35 : 0,
          transition: "opacity 1.5s ease",
        }}
      />

      {/* ── Green bottom ambient glow ─────────────────────────────────────── */}
      <div
        style={{
          ...styles.bottomAmbientGlow,
          opacity: phase >= 2 ? 0.3 : 0,
          transition: "opacity 1.5s ease",
        }}
      />

      {/* ── Bottom horizon glow line (tricolor gradient) ──────────────────── */}
      <div
        style={{
          ...styles.horizonGlow,
          opacity: phase >= 1 ? 0.6 : 0,
          transition: "opacity 1s ease",
        }}
      />

      {/* ── Burst flash on impact (phase 5) ──────────────────────────────── */}
      {phase === 5 && <div style={styles.impactFlash} />}

      {/* ── Main logo container ───────────────────────────────────────────── */}
      <div style={styles.logoContainer}>

        {/* ── Row 1: D · S · C ─────────────────────────────────────────── */}
        <div style={styles.dscRow}>

          {/* D — slides from left (SAFFRON theme) */}
          <span
            style={{
              ...styles.letterBase,
              ...styles.letterD,
              opacity: phase >= 1 ? 1 : 0,
              transform: phase >= 1 ? "translateX(0) skewX(0deg)" : "translateX(-120vw) skewX(-15deg)",
              transition: phase >= 1 ? "transform 0.75s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease" : "none",
              filter: settled
                ? "drop-shadow(0 0 22px rgba(255,153,51,0.8)) drop-shadow(0 0 44px rgba(255,153,51,0.4))"
                : "drop-shadow(0 0 10px rgba(255,153,51,0.5))",
            }}
          >
            D
          </span>

          {/* S — drops from top (premium: tricolor chrome metallic — brighter, shinier) */}
          <span
            style={{
              ...styles.letterBase,
              ...styles.letterS,
              opacity: phase >= 3 ? 1 : 0,
              transform: phase >= 3 ? "translateY(0) scale(1)" : "translateY(-110vh) scale(0.7)",
              transition: phase >= 3 ? "transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease" : "none",
            }}
          >
            S
          </span>

          {/* C — slides from right (GREEN theme) */}
          <span
            style={{
              ...styles.letterBase,
              ...styles.letterC,
              opacity: phase >= 2 ? 1 : 0,
              transform: phase >= 2 ? "translateX(0) skewX(0deg)" : "translateX(120vw) skewX(15deg)",
              transition: phase >= 2 ? "transform 0.75s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease" : "none",
              filter: settled
                ? "drop-shadow(0 0 22px rgba(19,136,8,0.8)) drop-shadow(0 0 44px rgba(19,136,8,0.4))"
                : "drop-shadow(0 0 10px rgba(19,136,8,0.5))",
            }}
          >
            C
          </span>
        </div>

        {/* ── Row 2: MOBILE — rises from bottom (tricolor gradient) ───── */}
        <div
          style={{
            ...styles.mobileWord,
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? "translateY(0) scaleX(1)" : "translateY(80vh) scaleX(0.8)",
            transition: phase >= 4 ? "transform 0.8s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease" : "none",
            textShadow: settled
              ? "0 0 30px rgba(255,153,51,0.5), 0 0 30px rgba(19,136,8,0.5), 0 0 60px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.8)"
              : "0 0 16px rgba(255,153,51,0.3), 0 0 16px rgba(19,136,8,0.3), 0 2px 4px rgba(0,0,0,0.8)",
          }}
        >
          {/* Individual letters for precise tricolor control */}
          <span style={styles.mobileSaffron}>M</span>
          <span style={styles.mobileSaffronLight}>O</span>
          <span style={styles.mobileWhite}>B</span>
          <span style={styles.mobileWhitePure}>I</span>
          <span style={styles.mobileGreenLight}>L</span>
          <span style={styles.mobileGreen}>E</span>
        </div>

        {/* ── Underline glow bar (tricolor gradient, appears at settle) ─── */}
        <div
          style={{
            ...styles.glowBar,
            opacity: settled ? 1 : 0,
            transform: settled ? "scaleX(1)" : "scaleX(0)",
            transition: "opacity 0.5s ease 0.1s, transform 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s",
          }}
        />

        {/* ── Tagline (appears after settle) ───────────────────────────── */}
        <div
          style={{
            ...styles.tagline,
            opacity: settled ? 1 : 0,
            transform: settled ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s",
          }}
        >
          Government of Andhra Pradesh · Class 3 DSC
        </div>
      </div>

      {/* ── S-specific aureola / lens-flare (premium Ashoka blue + white glow) ── */}
      {phase >= 3 && (
        <div
          style={{
            ...styles.sAureola,
            opacity: settled ? 0.9 : 0.6,
            transform: settled ? "scale(1.15)" : "scale(1)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        />
      )}

      {/* ── Speed lines (saffron during D entry, green during C entry) ──── */}
      {phase === 1 && <div style={{ ...styles.speedLines, ...styles.speedLinesLeft }} />}
      {phase === 2 && <div style={{ ...styles.speedLines, ...styles.speedLinesRight }} />}
    </div>
  );
}

// ── Static style objects ────────────────────────────────────────────────────

const styles = {
  ambientGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(255,153,51,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(19,136,8,0.025) 1px, transparent 1px)
    `,
    backgroundSize: "60px 60px",
    pointerEvents: "none",
  },

  // Soft saffron glow at the top of the screen
  topAmbientGlow: {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "80vw",
    height: "35vh",
    background: "radial-gradient(ellipse at top center, rgba(255,153,51,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
  },

  // Soft green glow at the bottom of the screen
  bottomAmbientGlow: {
    position: "absolute",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "80vw",
    height: "35vh",
    background: "radial-gradient(ellipse at bottom center, rgba(19,136,8,0.1) 0%, transparent 70%)",
    pointerEvents: "none",
  },

  horizonGlow: {
    position: "absolute",
    bottom: "18%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "60vw",
    height: "1px",
    background: "linear-gradient(90deg, transparent, rgba(255,153,51,0.6), rgba(255,255,255,0.9), rgba(19,136,8,0.6), transparent)",
    boxShadow: "0 0 40px 12px rgba(255,153,51,0.15), 0 0 40px 12px rgba(19,136,8,0.15), 0 0 80px 24px rgba(255,255,255,0.08)",
    pointerEvents: "none",
  },

  impactFlash: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, rgba(255,153,51,0.08) 35%, rgba(19,136,8,0.05) 60%, transparent 80%)",
    animation: "splashImpactFlash 0.6s ease forwards",
    pointerEvents: "none",
  },

  logoContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.1em",
    position: "relative",
    zIndex: 10,
    userSelect: "none",
  },

  dscRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "0.02em",
    position: "relative",
  },

  letterBase: {
    display: "inline-block",
    fontFamily: "'Arial Black', 'Impact', 'Haettenschweiler', sans-serif",
    fontWeight: 900,
    fontSize: "clamp(72px, 18vw, 160px)",
    letterSpacing: "-0.02em",
    lineHeight: 1,
    color: "#ffffff",
    willChange: "transform, opacity",
  },

  // D — Saffron / Orange metallic gradient
  letterD: {
    background: "linear-gradient(180deg, #FFD699 0%, #FFB347 20%, #FF9933 45%, #E68A2E 70%, #FFD699 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },

  // C — India Green metallic gradient
  letterC: {
    background: "linear-gradient(180deg, #7AE87A 0%, #2ECC40 20%, #138808 45%, #0D6B06 70%, #7AE87A 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },

  // S — premium tricolor chrome metallic gradient (saffron → white → green)
  // with Ashoka blue highlights
  letterS: {
    fontFamily: "'Arial Black', 'Impact', 'Haettenschweiler', sans-serif",
    fontWeight: 900,
    fontSize: "clamp(80px, 20vw, 176px)",
    background: `linear-gradient(
      160deg,
      #FFB347 0%,
      #FF9933 12%,
      #FFD699 22%,
      #FFFFFF 32%,
      #F0F0F0 42%,
      #FFFFFF 50%,
      #E8E8E8 58%,
      #FFFFFF 65%,
      #7AE87A 75%,
      #138808 85%,
      #1AAF0D 95%,
      #0D6B06 100%
    )`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    filter: `
      drop-shadow(0 0 20px rgba(255,153,51,0.7))
      drop-shadow(0 0 20px rgba(19,136,8,0.7))
      drop-shadow(0 0 40px rgba(0,0,128,0.5))
      drop-shadow(0 0 6px rgba(255,255,255,0.9))
    `,
    willChange: "transform, opacity",
    position: "relative",
    zIndex: 2,
  },

  // MOBILE word base styles
  mobileWord: {
    fontFamily: "'Arial Black', 'Impact', 'Haettenschweiler', sans-serif",
    fontWeight: 900,
    fontSize: "clamp(28px, 7.5vw, 68px)",
    letterSpacing: "0.28em",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginTop: "-0.05em",
    willChange: "transform, opacity",
  },

  // Individual MOBILE letter colors for tricolor flow
  // M, O → Saffron range
  mobileSaffron: {
    background: "linear-gradient(180deg, #FFD699 0%, #FF9933 50%, #E68A2E 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  mobileSaffronLight: {
    background: "linear-gradient(180deg, #FFE0B2 0%, #FFB347 50%, #FF9933 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  // B, I → White range
  mobileWhite: {
    background: "linear-gradient(180deg, #FFFFFF 0%, #E8E8E8 50%, #FFFFFF 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  mobileWhitePure: {
    background: "linear-gradient(180deg, #F8F8F8 0%, #FFFFFF 50%, #F0F0F0 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  // L, E → Green range
  mobileGreenLight: {
    background: "linear-gradient(180deg, #7AE87A 0%, #1AAF0D 50%, #138808 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  mobileGreen: {
    background: "linear-gradient(180deg, #2ECC40 0%, #138808 50%, #0D6B06 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },

  // Tricolor gradient glow bar
  glowBar: {
    width: "clamp(160px, 28vw, 340px)",
    height: "2px",
    marginTop: "0.5em",
    background: "linear-gradient(90deg, transparent, rgba(255,153,51,0.9), rgba(255,255,255,0.95), rgba(19,136,8,0.9), transparent)",
    boxShadow: "0 0 12px 4px rgba(255,153,51,0.35), 0 0 12px 4px rgba(19,136,8,0.35), 0 0 24px 8px rgba(0,0,128,0.15)",
    transformOrigin: "center",
  },

  tagline: {
    marginTop: "0.8em",
    fontSize: "clamp(9px, 1.4vw, 13px)",
    letterSpacing: "0.2em",
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter, Arial, sans-serif",
    fontWeight: 600,
    textTransform: "uppercase",
  },

  // Aureola behind S — soft radial halo with Ashoka blue core + tricolor edges
  sAureola: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "clamp(160px, 24vw, 280px)",
    height: "clamp(160px, 24vw, 280px)",
    background: `radial-gradient(
      ellipse at center,
      rgba(0,0,128,0.18) 0%,
      rgba(255,255,255,0.12) 25%,
      rgba(255,153,51,0.08) 45%,
      rgba(19,136,8,0.06) 60%,
      transparent 80%
    )`,
    borderRadius: "50%",
    pointerEvents: "none",
    zIndex: 1,
    willChange: "transform, opacity",
  },

  speedLines: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "50%",
    pointerEvents: "none",
    zIndex: 5,
  },

  // Saffron speed lines when D enters from left
  speedLinesLeft: {
    left: 0,
    background: "linear-gradient(90deg, rgba(255,153,51,0.08) 0%, transparent 100%)",
  },

  // Green speed lines when C enters from right
  speedLinesRight: {
    right: 0,
    background: "linear-gradient(270deg, rgba(19,136,8,0.08) 0%, transparent 100%)",
  },
};
