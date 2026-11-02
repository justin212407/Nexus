import React from "react";
import { motion, useReducedMotion } from "motion/react";

/*
 * Subtle ambient background for empty states only (Aceternity-style spotlight).
 * Purely decorative, never interactive, and static under reduced motion.
 */
export default function Spotlight({ className = "" }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      initial={{ opacity: 0 }}
      animate={
        reduced ? { opacity: 0.45 } : { opacity: [0.2, 0.45, 0.2] }
      }
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 7, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <div className="absolute left-1/2 top-0 h-[420px] w-[640px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(36,89,211,0.16),transparent)] blur-2xl" />
    </motion.div>
  );
}
