import type { Metadata } from "next";
import { ControlRoom } from "@/components/control-room/ControlRoom";

export const metadata: Metadata = {
  title: "Control Room · PromptFence",
};

export default function DashboardPage() {
  return <ControlRoom />;
}
