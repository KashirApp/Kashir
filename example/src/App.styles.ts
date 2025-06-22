import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // Login Screen Styles
  loginSafeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  loginTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  loginHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Header Styles
  headerContainer: {
    padding: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10,
  },
  inputContainer: {
    padding: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  postsContainer: {
    flex: 1,
  },
  postCount: {
    padding: 15,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  postCard: {
    backgroundColor: 'white',
    padding: 15,
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginTop: 15,
  },
}); 