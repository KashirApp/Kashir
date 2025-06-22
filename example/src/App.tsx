import { useState, useEffect } from 'react';
import { Text, View, TextInput, Button, ScrollView, ActivityIndicator, Alert, SafeAreaView, TouchableOpacity } from 'react-native';
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
    <SafeAreaView style={styles.loginSafeArea}>
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
    </SafeAreaView>
  );
}

// Tab types
type TabType = 'your-posts' | 'following';

// Posts Screen Component (renamed from the main component)
function PostsScreen({ userNpub, onLogout }: { userNpub: string, onLogout: () => void }) {
  const [posts, setPosts] = useState<EventInterface[]>([]);
  const [followingPosts, setFollowingPosts] = useState<EventInterface[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('your-posts');
  const [followingList, setFollowingList] = useState<PublicKey[]>([]);

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

  // Fetch following list
  const fetchFollowingList = async () => {
    if (!client || !isClientReady || !userNpub) return;
    
    try {
      const publicKey = PublicKey.parse(userNpub);
      
      // Create filter for kind 3 (contact list) events
      const contactListFilter = new Filter()
        .author(publicKey)
        .kinds([new Kind(3)])
        .limit(1n);
      
      console.log('Fetching following list...');
      
      const events = await client.fetchEvents(contactListFilter, 10000 as any);
      const eventArray = events.toVec();
      
      if (eventArray.length > 0) {
        const contactListEvent = eventArray[0];
        if (contactListEvent) {
          // Check if event has direct methods for getting following
          console.log('Contact list event:', contactListEvent);
          console.log('Contact list event type:', typeof contactListEvent);
          if (contactListEvent && typeof contactListEvent === 'object') {
            const eventMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(contactListEvent));
            console.log('Contact list event methods:', eventMethods);
            // Check for following-related methods
            const followingMethods = eventMethods.filter(m => 
              m.toLowerCase().includes('follow') || 
              m.toLowerCase().includes('contact') ||
              m.toLowerCase().includes('pubkey') ||
              m.toLowerCase().includes('public')
            );
            if (followingMethods.length > 0) {
              console.log('Found following-related methods:', followingMethods);
            }
          }
          
          const tags = contactListEvent.tags();
          
          // Debug: log the tags object structure
          console.log('Tags object:', tags);
          console.log('Tags type:', typeof tags);
          console.log('Tags constructor:', tags?.constructor?.name);
          
          // Try to see what methods are available
          if (tags) {
            const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(tags));
            console.log('Available methods:', methods);
            // Check if there's a method to get public keys directly
            if (methods.includes('publicKeys') || methods.includes('public_keys')) {
              console.log('Found publicKeys method');
            }
          }
          
          const followingPubkeys: PublicKey[] = [];
          
          // Extract public keys from p tags
          let tagArray: any[] = [];
          try {
            // Based on Python example, should be to_vec() with underscore
            if (tags && typeof tags.to_vec === 'function') {
              tagArray = tags.to_vec();
            } else if (tags && typeof tags.toVec === 'function') {
              tagArray = tags.toVec();
            } else if (Array.isArray(tags)) {
              tagArray = tags;
            } else {
              console.log('Could not convert tags to array');
            }
          } catch (e) {
            console.error('Error converting tags to array:', e);
          }
          
          console.log(`Processing ${tagArray.length} tags`);
          
          for (let i = 0; i < tagArray.length && i < 3; i++) {
            const tag = tagArray[i];
            console.log(`Tag ${i}:`, tag);
            console.log(`Tag ${i} type:`, typeof tag);
            if (tag && typeof tag === 'object') {
              console.log(`Tag ${i} methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(tag)));
            }
          }
          
          for (const tag of tagArray) {
            try {
              // Based on Python example, should be as_vec() with underscore
              let tagData: any[] = [];
              if (Array.isArray(tag)) {
                tagData = tag;
              } else if (tag && typeof tag.as_vec === 'function') {
                tagData = tag.as_vec();
              } else if (tag && typeof tag.asVec === 'function') {
                tagData = tag.asVec();
              } else if (tag && typeof tag.toVec === 'function') {
                tagData = tag.toVec();
              }
              
              if (tagData.length > 1 && tagData[0] === 'p') {
                try {
                  // tagData[1] contains the hex string
                  const hexPubkey = tagData[1] as string;
                  console.log('Processing hex pubkey:', hexPubkey.substring(0, 8) + '...');
                  
                  // Try different approaches to create PublicKey from hex
                  let pubkey = null;
                  
                  // Check if Tag has a method to extract public key
                  if (tag && typeof tag.publicKey === 'function') {
                    pubkey = tag.publicKey();
                  } else if (tag && typeof tag.public_key === 'function') {
                    pubkey = tag.public_key();
                  } else {
                    // Try to use PublicKey constructor or parse with hex prefix
                    try {
                      // Some SDKs accept hex with a prefix
                      pubkey = PublicKey.parse(hexPubkey);
                    } catch (e1) {
                      // If that doesn't work, try with 'hex:' prefix
                      try {
                        pubkey = PublicKey.parse('hex:' + hexPubkey);
                      } catch (e2) {
                        console.log('Could not parse hex pubkey directly');
                      }
                    }
                  }
                  
                  if (pubkey) {
                    followingPubkeys.push(pubkey);
                  } else {
                    console.log('Could not create PublicKey from hex:', hexPubkey.substring(0, 8) + '...');
                  }
                } catch (error) {
                  console.error('Error parsing pubkey from tag:', error);
                }
              }
            } catch (tagError) {
              console.error('Error processing tag:', tagError);
            }
          }
          
          console.log(`Found ${followingPubkeys.length} people in following list`);
          setFollowingList(followingPubkeys);
          return followingPubkeys;
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching following list:', error);
      return [];
    }
  };

  // Fetch posts from following
  const fetchFollowingPosts = async () => {
    if (!client || !isClientReady) {
      Alert.alert('Error', 'Client not ready. Please wait and try again.');
      return;
    }

    setFollowingLoading(true);
    setFollowingPosts([]);

    try {
      // First fetch the following list if we don't have it
      let following = followingList;
      if (following.length === 0) {
        following = await fetchFollowingList();
      }
      
      if (following.length === 0) {
        Alert.alert('No Following', 'You are not following anyone yet.');
        setFollowingLoading(false);
        return;
      }

      console.log(`Fetching posts from ${following.length} people...`);
      
      // Create filter for posts from following
      const followingFilter = new Filter()
        .authors(following)
        .kinds([new Kind(1)])
        .limit(100n);
      
      console.log('Fetching following posts...');
      
      const events = await client.fetchEvents(followingFilter, 30000 as any);
      const eventArray = events.toVec();
      
      console.log(`Fetched ${eventArray.length} posts from following`);
      
      if (eventArray.length > 0) {
        // Sort by timestamp
        eventArray.sort((a, b) => {
          const timeA = a.createdAt().asSecs();
          const timeB = b.createdAt().asSecs();
          return Number(timeB - timeA);
        });
        
        setFollowingPosts(eventArray);
      } else {
        Alert.alert(
          'No posts found', 
          'No recent posts from people you follow.'
        );
      }
    } catch (error) {
      console.error('Error fetching following posts:', error);
      Alert.alert(
        'Error', 
        `Failed to fetch posts from following: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setFollowingLoading(false);
    }
  };

  // Auto-fetch posts and profile when client is ready
  useEffect(() => {
    if (isClientReady && userNpub) {
      fetchPosts();
      fetchUserProfile();
      fetchFollowingList();
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

  const handleRefresh = () => {
    if (activeTab === 'your-posts') {
      fetchPosts();
    } else {
      fetchFollowingPosts();
    }
  };

  const renderPost = (post: EventInterface, index: number, totalPosts: number) => {
    // Get author info for following posts
    const isFollowingTab = activeTab === 'following';
    let authorName = '';
    
    if (isFollowingTab) {
      const authorPubkey = post.author();
      // Show shortened hex for now - in a real app you'd fetch profiles
      authorName = authorPubkey.toHex().substring(0, 8) + '...';
    }

    return (
      <View key={post.id().toHex()} style={styles.postCard}>
        {isFollowingTab && (
          <Text style={styles.postAuthor}>@{authorName}</Text>
        )}
        <Text style={styles.postDate}>{formatTimestamp(post.createdAt())}</Text>
        <Text style={styles.postContent}>{post.content()}</Text>
        {index < totalPosts - 1 && <View style={styles.separator} />}
      </View>
    );
  };

  const currentPosts = activeTab === 'your-posts' ? posts : followingPosts;
  const currentLoading = activeTab === 'your-posts' ? loading : followingLoading;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <Button 
            title={profileLoading ? '...' : userName || 'Loading...'} 
            onPress={handleUserNamePress}
            disabled={profileLoading}
          />
          <Text style={styles.title}>Nostr Feed</Text>
          <Button title="Logout" onPress={onLogout} />
        </View>
        <Text style={styles.subtitle}>
          {isClientReady ? '✅ Connected to relays' : '⏳ Connecting to relays...'}
        </Text>
        
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'your-posts' && styles.activeTab]}
            onPress={() => setActiveTab('your-posts')}
          >
            <Text style={[styles.tabText, activeTab === 'your-posts' && styles.activeTabText]}>
              Your Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'following' && styles.activeTab]}
            onPress={() => {
              setActiveTab('following');
              // Fetch following posts if not already loaded
              if (followingPosts.length === 0 && !followingLoading) {
                fetchFollowingPosts();
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
              Following {followingList.length > 0 ? `(${followingList.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerButtons}>
          <Button 
            title="Refresh" 
            onPress={handleRefresh} 
            disabled={currentLoading || !isClientReady} 
          />
        </View>
      </View>

      {currentLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            {activeTab === 'your-posts' ? 'Fetching your posts...' : 'Fetching posts from following...'}
          </Text>
        </View>
      )}

      <ScrollView style={styles.postsContainer}>
        {currentPosts.length > 0 && (
          <Text style={styles.postCount}>
            Found {currentPosts.length} {activeTab === 'your-posts' ? 'posts' : 'posts from following'}
          </Text>
        )}
        {currentPosts.map((post, index) => renderPost(post, index, currentPosts.length))}
      </ScrollView>
    </SafeAreaView>
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
