import React, { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

export default function NumberTicker({
  value,
  duration = 0.6,
  className = "",
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(reduced ? value : 0);
  const display = useTransform(motionValue, (latest) =>
    Math.round(latest).toLocaleString(),
  );

  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(motionValue, value, {
      duration,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [value, inView, reduced, duration, motionValue]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}
