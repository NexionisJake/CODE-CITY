"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
    start: [number, number, number];
    end: [number, number, number];
    color?: string;
    speed?: number;  // 0-1, loops every (1/speed) seconds
    offset?: number; // 0-1, phase offset so not all pulses sync
}

export default function RoadPulse({ start, end, color = "#00ccff", speed = 0.4, offset = 0 }: Props) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        // t goes 0→1 repeatedly, with phase offset
        const t = ((clock.getElapsedTime() * speed + offset) % 1);
        // Lerp position along the road
        meshRef.current.position.set(
            start[0] + (end[0] - start[0]) * t,
            start[1] + (end[1] - start[1]) * t + 0.4,
            start[2] + (end[2] - start[2]) * t,
        );
        // Fade in at start, fade out at end
        const opacity = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1.0;
        (meshRef.current.material as THREE.MeshStandardMaterial).opacity = opacity;
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[0.5, 6, 6]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={2.0}
                transparent
                opacity={1}
            />
        </mesh>
    );
}
