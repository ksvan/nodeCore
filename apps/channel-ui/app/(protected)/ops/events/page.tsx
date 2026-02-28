import { EventStreamViewer } from "@/components/event-stream-viewer";

export default function OpsEventsPage() {
  return (
    <EventStreamViewer
      title="Events Viewer"
      description="Live WebSocket events stream from /ws/events."
      wsUrl={process.env.NEXT_PUBLIC_CORE_WS_URL}
      wsEndpointHint="ws://localhost:4000/ws/events"
    />
  );
}
