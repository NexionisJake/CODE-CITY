"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface Props {
    position: { x: number; y: number; z: number };
    dimensions: { width: number; depth: number };
    heatScore: number;   // 0-10
    messageCount: number;
}

export default function SocialHalo({ position, dimensions, heatScore, messageCount }: Props) {
    const meshRef = useRef<THREE.Mesh>(null);
    if (heatScore < 1.0) return null;

    const outerR = Math.max(dimensions.width, dimensions.depth) / 2 + 3.5;
    const innerR = outerR - 1.8;

    // Color: low heat = amber, high heat = red
    const heatFraction = Math.min(heatScore / 10, 1);
    const r = 1.0;
    const g = Math.max(0.1, 0.6 - heatFraction * 0.5);
    const b = 0.0;
    const color = new THREE.Color(r, g, b);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        // Pulse faster with more heat
        const speed = 1.5 + heatFraction * 2.5;
        const pulse = 0.5 + Math.sin(clock.getElapsedTime() * speed) * 0.5;
        mat.emissiveIntensity = 0.8 + pulse * 1.5;
        mat.opacity = 0.5 + pulse * 0.4;
    });

    return (
        <group>
            {/* Outer pulsing social ring */}
            <mesh
                ref={meshRef}
                position={[position.x, 0.12, position.z]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <ringGeometry args={[innerR, outerR, 48]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={1.2}
                    transparent
                    opacity={0.7}
                    depthWrite={false}
                />
            </mesh>

            {/* Message count badge — floating pill above building corner */}
            {messageCount > 0 && (
                <Html
                    position={[position.x + outerR * 0.7, position.y + 4, position.z + outerR * 0.7]}
                    center
                    style={{ pointerEvents: "none" }}
                >
                    <div style={{
                        background: "rgba(10,10,20,0.92)",
                        color: "#fb923c",
                        padding: "3px 8px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                        border: "1px solid rgba(251,146,60,0.4)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    }}>
                        💬 {messageCount}
                    </div>
                </Html>
            )}
        </group>
    );
}
