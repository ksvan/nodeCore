import { EventStreamViewer } from "@/components/event-stream-viewer";

const deriveBusinessWsUrl = (allEventsUrl: string | undefined): string | undefined => {
  if (!allEventsUrl) {
    return undefined;
  }
  return allEventsUrl.replace(/\/ws\/events$/, "/ws/business-events");
};

export default function OpsBusinessEventsPage() {
  const wsUrl =
    process.env.NEXT_PUBLIC_CORE_BUSINESS_WS_URL ?? deriveBusinessWsUrl(process.env.NEXT_PUBLIC_CORE_WS_URL);

  return (
    <EventStreamViewer
      title="Business Events Viewer"
      description="Curated business events stream from /ws/business-events."
      wsUrl={wsUrl}
      wsEndpointHint="ws://localhost:4000/ws/business-events"
      supportsSubscribeFilters
    />
  );
}
