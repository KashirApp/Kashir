import { useState, useEffect } from 'react';
import { Text, View, TextInput, Button, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { PublicKey, Client, Filter, Kind } from '../../src';
import type { EventInterface, TimestampInterface } from '../../src';
import { styles } from './App.styles';

// Login Screen Component
function LoginScreen({ onLogin }: { onLogin: (npub: string) => void }) {
  const [npubInput, setNpubInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!npubInput.trim()) {
      Alert.alert('Error', 'Please enter your npub key');
      return;
    }

    setLoading(true);
    try {
      // Validate the npub key by trying to parse it
      PublicKey.parse(npubInput.trim());
      onLogin(npubInput.trim());
    } catch (error) {
      Alert.alert('Error', 'Invalid npub key. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.loginContainer}>
        <Text style={styles.loginTitle}>Welcome to Nostr</Text>
        <Text style={styles.loginSubtitle}>Enter your npub to view your posts</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Enter your npub key (e.g., npub1...)"
          value={npubInput}
          onChangeText={setNpubInput}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        
        <Button 
          title={loading ? "Validating..." : "Login"} 
          onPress={handleLogin} 
          disabled={loading}
        />
        
        <Text style={styles.loginHint}>
          Don't have an npub? You can test with:{'\n'}
          npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m
        </Text>
      </View>
    </View>
  );
}

// Posts Screen Component (renamed from the main component)
function PostsScreen({ userNpub, onLogout }: { userNpub: string, onLogout: () => void }) {
  const [posts, setPosts] = useState<EventInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [profileLoading, setProfileLoading] = useState(false);

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

  // Fetch user profile/name
  const fetchUserProfile = async () => {
    if (!client || !isClientReady || !userNpub) return;
    
    setProfileLoading(true);
    try {
      const publicKey = PublicKey.parse(userNpub);
      
      // Create filter for kind 0 (metadata/profile) events
      const profileFilter = new Filter()
        .author(publicKey)
        .kinds([new Kind(0)])
        .limit(1n);
      
      console.log('Fetching user profile...');
      
      try {
        const events = await client.fetchEvents(profileFilter, 10000 as any);
        const eventArray = events.toVec();
        
        if (eventArray.length > 0) {
          const profileEvent = eventArray[0];
          if (profileEvent) {
            const content = profileEvent.content();
            
            try {
              const profileData = JSON.parse(content);
              const name = profileData.name || profileData.display_name || profileData.username;
              
              if (name) {
                setUserName(name);
                console.log('Found user name:', name);
              } else {
                // Fallback to shortened npub
                const shortNpub = userNpub.substring(0, 8) + '...';
                setUserName(shortNpub);
              }
            } catch (parseError) {
              console.error('Error parsing profile JSON:', parseError);
              // Fallback to shortened npub
              const shortNpub = userNpub.substring(0, 8) + '...';
              setUserName(shortNpub);
            }
          }
        } else {
          // No profile found, use shortened npub
          const shortNpub = userNpub.substring(0, 8) + '...';
          setUserName(shortNpub);
        }
      } catch (fetchError) {
        console.error('Error fetching profile:', fetchError);
        // Fallback to shortened npub
        const shortNpub = userNpub.substring(0, 8) + '...';
        setUserName(shortNpub);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      // Fallback to shortened npub
      const shortNpub = userNpub.substring(0, 8) + '...';
      setUserName(shortNpub);
    } finally {
      setProfileLoading(false);
    }
  };

  // Auto-fetch posts and profile when client is ready
  useEffect(() => {
    if (isClientReady && userNpub) {
      fetchPosts();
      fetchUserProfile();
    }
  }, [isClientReady, userNpub]);

  const fetchPosts = async () => {
    if (!client || !isClientReady) {
      Alert.alert('Error', 'Client not ready. Please wait and try again.');
      return;
    }

    setLoading(true);
    setPosts([]);

    try {
      // Parse the npub key
      const publicKey = PublicKey.parse(userNpub);
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
          '1. You have no posts yet\n' +
          '2. The relays might not have your data\n' +
          '3. The connection might be slow\n\n' +
          'Try refreshing in a few seconds.'
        );
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      Alert.alert(
        'Error', 
        `Failed to fetch posts: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: TimestampInterface) => {
    const date = new Date(Number(timestamp.asSecs()) * 1000);
    return date.toLocaleString();
  };

  const handleUserNamePress = () => {
    Alert.alert(
      'User Profile',
      `Full npub: ${userNpub}\n\nName: ${userName}`,
      [
        { text: 'Copy npub', onPress: () => console.log('Copy functionality not implemented') },
        { text: 'OK' }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <Button 
            title={profileLoading ? '...' : userName || 'Loading...'} 
            onPress={handleUserNamePress}
            disabled={profileLoading}
          />
          <Text style={styles.title}>Your Posts</Text>
          <Button title="Logout" onPress={onLogout} />
        </View>
        <Text style={styles.subtitle}>
          {isClientReady ? '✅ Connected to relays' : '⏳ Connecting to relays...'}
        </Text>
        <View style={styles.headerButtons}>
          <Button title="Refresh" onPress={fetchPosts} disabled={loading || !isClientReady} />
        </View>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Fetching your posts...</Text>
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

// Main App Component
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userNpub, setUserNpub] = useState('');

  const handleLogin = (npub: string) => {
    setUserNpub(npub);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserNpub('');
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <PostsScreen userNpub={userNpub} onLogout={handleLogout} />;
}
