import { useState, useEffect } from 'react';
import { Text, View, TextInput, Button, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { PublicKey, Client, Filter, Kind } from '../../src';
import type { EventInterface, TimestampInterface } from '../../src';
import { styles } from './App.styles';

export default function App() {
  const [npubInput, setNpubInput] = useState('');
  const [posts, setPosts] = useState<EventInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);

  // Initialize client on mount
  useEffect(() => {
    const initClient = async () => {
      try {
        // Create a new client without signer (we're just reading)
        const newClient = new Client();
        
        // Add some popular Nostr relays
        await newClient.addRelay('wss://relay.damus.io');
        await newClient.addRelay('wss://nos.lol');
        await newClient.addRelay('wss://relay.nostr.band');
        await newClient.addRelay('wss://relay.nostr.info');
        await newClient.addRelay('wss://nostr.wine');
        await newClient.addRelay('wss://relay.snort.social');
        
        // Connect to relays
        await newClient.connect();
        
        // Wait a bit for connections to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setClient(newClient);
        setIsClientReady(true);
        console.log('Client initialized and connected to relays');
      } catch (error) {
        console.error('Failed to initialize client:', error);
        Alert.alert('Error', 'Failed to connect to Nostr relays');
      }
    };

    initClient();

    // Cleanup on unmount
    return () => {
      if (client) {
        client.disconnect();
      }
    };
  }, []);

  const fetchPosts = async () => {
    if (!npubInput.trim()) {
      Alert.alert('Error', 'Please enter an npub key');
      return;
    }

    if (!client || !isClientReady) {
      Alert.alert('Error', 'Client not ready. Please wait and try again.');
      return;
    }

    setLoading(true);
    setPosts([]);

    try {
      // Parse the npub key
      const publicKey = PublicKey.parse(npubInput.trim());
      console.log('Parsed public key:', publicKey.toHex());
      console.log('Public key bech32:', publicKey.toBech32());
      
      // Try different filter approaches
      console.log('Creating filter...');
      
      // Create filter with chaining - try with regular number for limit
      const filter = new Filter()
        .author(publicKey)
        .kinds([new Kind(1)])
        .limit(50n);  // Use BigInt as expected by the SDK
      
      console.log('Final filter:', filter.asJson());
      
      console.log('Fetching events with filter...');
      
      let allEvents: EventInterface[] = [];
      
      try {
        // Try with milliseconds as integer
        const timeoutMs = 30000; // 30 seconds in milliseconds
        const events = await client.fetchEvents(filter, timeoutMs as any);
        console.log('Fetched events:', events);
        
        const eventArray = events.toVec();
        console.log(`Fetched ${eventArray.length} events`);
        
        if (eventArray.length > 0) {
          allEvents = eventArray;
        }
      } catch (fetchError) {
        console.error('Error during fetch with milliseconds timeout:', fetchError);
        
        // Try with Duration-like object
        try {
          // Try passing an object that might match Duration structure
          const duration = { secs: 30n, nanos: 0 }; // BigInt for seconds
          console.log('Trying with Duration object:', duration);
          
          const events2 = await client.fetchEvents(filter, duration as any);
          const eventArray2 = events2.toVec();
          console.log(`Second attempt fetched ${eventArray2.length} events`);
          
          if (eventArray2.length > 0) {
            allEvents = eventArray2;
          }
        } catch (fetchError2) {
          console.error('Error during second fetch attempt:', fetchError2);
          
          // Try one more time with a simple filter and different timeout format
          console.log('Trying simplified approach...');
          const simpleFilter = new Filter().author(publicKey);
          
          try {
            // Try with just seconds as BigInt
            const events3 = await client.fetchEvents(simpleFilter, 30n as any);
            const eventArray3 = events3.toVec();
            console.log(`Simple filter fetched ${eventArray3.length} events`);
            
            if (eventArray3.length > 0) {
              // Filter for kind 1 manually
              const textNotes = eventArray3.filter(event => {
                try {
                  const eventKind = event.kind();
                  console.log('Event kind:', eventKind);
                  return eventKind.asU16() === 1;
                } catch (e) {
                  console.error('Error checking event kind:', e);
                  return false;
                }
              });
              
              console.log(`Found ${textNotes.length} text notes`);
              allEvents = textNotes;
            }
          } catch (fetchError3) {
            console.error('Error during third fetch attempt:', fetchError3);
            
            // Final attempt with nanoseconds
            try {
              const nanos = 30_000_000_000n; // 30 seconds in nanoseconds as BigInt
              console.log('Final attempt with nanoseconds:', nanos);
              const events4 = await client.fetchEvents(filter, nanos as any);
              const eventArray4 = events4.toVec();
              console.log(`Final attempt fetched ${eventArray4.length} events`);
              
              if (eventArray4.length > 0) {
                allEvents = eventArray4;
              }
            } catch (fetchError4) {
              console.error('Error during final fetch attempt:', fetchError4);
            }
          }
        }
      }
      
      // Sort and set posts
      if (allEvents.length > 0) {
        allEvents.sort((a, b) => {
          const timeA = a.createdAt().asSecs();
          const timeB = b.createdAt().asSecs();
          return Number(timeB - timeA);
        });
        
        setPosts(allEvents);
      } else {
        Alert.alert(
          'No posts found', 
          'This could be because:\n' +
          '1. The user has no posts\n' +
          '2. The relays might not have this user\'s data\n' +
          '3. The connection might be slow\n\n' +
          'Try again in a few seconds.\n\n' +
          'You can also try testing with jack\'s npub:\n' +
          'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m'
        );
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      Alert.alert(
        'Error', 
        `Failed to fetch posts: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check the npub key and try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: TimestampInterface) => {
    const date = new Date(Number(timestamp.asSecs()) * 1000);
    return date.toLocaleString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Text style={styles.title}>Nostr Post Viewer</Text>
        <Text style={styles.subtitle}>
          {isClientReady ? '✅ Connected to relays' : '⏳ Connecting to relays...'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Enter npub key (e.g., npub1...)"
          value={npubInput}
          onChangeText={setNpubInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button 
          title="Fetch Posts" 
          onPress={fetchPosts} 
          disabled={loading || !isClientReady} 
        />
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Fetching posts...</Text>
        </View>
      )}

      <ScrollView style={styles.postsContainer}>
        {posts.length > 0 && (
          <Text style={styles.postCount}>Found {posts.length} posts</Text>
        )}
        {posts.map((post, index) => (
          <View key={post.id().toHex()} style={styles.postCard}>
            <Text style={styles.postDate}>{formatTimestamp(post.createdAt())}</Text>
            <Text style={styles.postContent}>{post.content()}</Text>
            {index < posts.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
