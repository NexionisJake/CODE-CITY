"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PULSE_COUNT = 3; // Number of staggered pulses per road

interface Props {
    start: [number, number, number];
    end: [number, number, number];
    color?: string;
    speed?: number;  // 0-1, lower = slower
    offset?: number; // 0-1, phase offset so not all pulses sync
    nightMode?: boolean;
}

/** A single animated sphere that travels from start→end */
function PulseSphere({
    start, end, color, speed = 0.12, offset = 0, nightMode, index,
}: Props & { index: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        // Each pulse is offset by index/PULSE_COUNT so they're evenly staggered
        const phase = (index / PULSE_COUNT) + offset;
        const t = ((clock.getElapsedTime() * speed + phase) % 1);

        // Lerp position along the road — stay ON the road surface
        meshRef.current.position.set(
            start[0] + (end[0] - start[0]) * t,
            start[1] + (end[1] - start[1]) * t + 0.15,
            start[2] + (end[2] - start[2]) * t,
        );

        // Fade in at start, fade out at end for a smooth loop
        const opacity = t < 0.08 ? t / 0.08 : t > 0.92 ? (1 - t) / 0.08 : 1.0;
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = opacity * 0.9;
    });

    const size = nightMode ? 0.7 : 0.45;

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[size, 6, 6]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={nightMode ? 4.0 : 2.0}
                transparent
                opacity={1}
                depthWrite={false}
            />
        </mesh>
    );
}

export default function RoadPulse({ start, end, color = "#00ccff", speed = 0.4, offset = 0, nightMode = false }: Props) {
    return (
        <group>
            {Array.from({ length: PULSE_COUNT }, (_, i) => (
                <PulseSphere
                    key={i}
                    index={i}
                    start={start}
                    end={end}
                    color={color}
                    speed={speed}
                    offset={offset}
                    nightMode={nightMode}
                />
            ))}
        </group>
    );
}
