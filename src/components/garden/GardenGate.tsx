"use client";

import { useAuth } from "@/context/AuthContext";
import GardenCompanion from "@/components/garden/GardenCompanion";

/**
 * For now only the site admin sees the garden companion, while it is being refined.
 * To open it to everyone again, return <GardenCompanion /> without the role check.
 */
export default function GardenGate() {
  const { role } = useAuth();
  return role === "admin" ? <GardenCompanion /> : null;
}
