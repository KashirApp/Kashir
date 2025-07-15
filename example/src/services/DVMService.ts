import { Filter, Kind, PublicKey, EventId } from 'kashir';
import type { EventInterface, Client } from 'kashir';

interface DVMResponse {
  eventIds: string[];
  responseId: string;
  createdAt: number;
}

export class DVMService {
  private readonly DVM_PUBKEY =
    'bb9b5961ac890ed6159172c399273b14f79b34cebad33ee6ca5ba14783528ebe';
  private readonly RESPONSE_KIND = 6300;

  async requestTrendingContent(client: Client): Promise<DVMResponse | null> {
    try {
      console.log('Fetching existing DVM trending responses...');
      const dvmPubkey = PublicKey.parse(this.DVM_PUBKEY);

      const dvmFilter = new Filter()
        .kind(new Kind(this.RESPONSE_KIND))
        .author(dvmPubkey)
        .limit(BigInt(50));

      let responseEvents = await client.fetchEvents(dvmFilter, 15000);

      // Convert EventsInterface to array using toVec() method
      let eventsArray: EventInterface[] = [];
      if (responseEvents) {
        try {
          eventsArray = responseEvents.toVec();
        } catch (e) {
          eventsArray = [];
        }
      }

      // Process any found events
      if (eventsArray.length > 0) {
        for (let i = 0; i < Math.min(eventsArray.length, 3); i++) {
          const response = eventsArray[i];
          if (response) {
            if (response.content().length > 0) {
              try {
                const contentJson = JSON.parse(response.content());
                const eventIds: string[] = [];

                if (Array.isArray(contentJson)) {
                  for (const tag of contentJson) {
                    if (
                      Array.isArray(tag) &&
                      tag.length === 2 &&
                      tag[0] === 'e'
                    ) {
                      eventIds.push(tag[1]);
                    }
                  }
                }

                if (eventIds.length > 0) {
                  return {
                    eventIds,
                    responseId: response.id().toString(),
                    createdAt: Number(response.createdAt().asSecs()),
                  };
                }
              } catch (parseError) {
                // Failed to parse JSON content, continue
              }
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('💥 DVM request failed:', error);
      return null;
    }
  }

  async fetchEventsByIds(
    client: Client,
    eventIds: string[]
  ): Promise<EventInterface[]> {
    try {
      console.log(`Fetching ${eventIds.length} trending events...`);

      if (eventIds.length === 0) {
        return [];
      }

      const allFetchedEvents: EventInterface[] = [];

      // Fetch events one by one (like nostr-cli)
      for (let i = 0; i < eventIds.length; i++) {
        const eventId = eventIds[i];
        if (!eventId) continue;

        try {
          const parsedEventId = EventId.parse(eventId);
          let foundEvent = null;

          // Use METHOD CHAINING - this is the key to success!
          const workingFilter = new Filter().id(parsedEventId).limit(BigInt(1));

          const fetchedEvents = await client.fetchEvents(workingFilter, 5000);

          if (fetchedEvents) {
            const eventsArray = fetchedEvents.toVec();

            if (eventsArray.length === 1) {
              const event = eventsArray[0];
              if (event) {
                const returnedIdStr = event.id().toString();

                // Use hex extraction for proper comparison
                let isCorrectEvent = returnedIdStr === eventId;
                if (!isCorrectEvent) {
                  const hexMatch = returnedIdStr.match(
                    /EventId\(([a-f0-9]{64})\)/
                  );
                  if (hexMatch) {
                    isCorrectEvent = hexMatch[1] === eventId;
                  }
                }

                if (isCorrectEvent) {
                  foundEvent = event;
                }
              }
            } else if (eventsArray.length > 1) {
              // Try client-side filtering as fallback
              const matchingEvent = eventsArray.find((event) => {
                const returnedIdStr = event.id().toString();

                // Try direct comparison first
                if (returnedIdStr === eventId) {
                  return true;
                }

                // Try extracting hex from the debug format
                const hexMatch = returnedIdStr.match(
                  /EventId\(([a-f0-9]{64})\)/
                );
                if (hexMatch) {
                  const extractedHex = hexMatch[1];
                  return extractedHex === eventId;
                }

                return false;
              });

              if (matchingEvent) {
                foundEvent = matchingEvent;
              }
            }
          }

          if (foundEvent) {
            allFetchedEvents.push(foundEvent);
          }
        } catch (eventError) {
          // Event fetch failed, continue
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Keep DVM trending order (don't sort by time)
      return allFetchedEvents;
    } catch (error) {
      console.error('Failed to fetch trending events:', error);
      return [];
    }
  }
}
