import { useState } from 'react'
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Text } from '@/components/ui/text'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { signInWithEmail, signUpWithEmail, getJwt } from '@/lib/auth'
import { signInWithGoogle } from '@/lib/oauth'

type AuthMode = 'signin' | 'signup'

interface AuthScreenProps {
  onAuthenticated: () => void
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Name is required')
          return
        }
        await signUpWithEmail(email, password, name)
      } else {
        await signInWithEmail(email, password)
      }

      const jwt = await getJwt()
      if (!jwt) {
        setError('Failed to obtain access token')
        return
      }

      onAuthenticated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)

    try {
      await signInWithGoogle()
      onAuthenticated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))
    setError(null)
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 py-12">
          <View className="items-center mb-8">
            <Text variant="h2">Shuchu</Text>
            <Text className="text-muted-foreground mt-1">
              {mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
            </Text>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>
                {mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="gap-4">
                {mode === 'signup' && (
                  <View>
                    <Text className="text-sm text-muted-foreground mb-1">Name</Text>
                    <Input
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      autoCapitalize="words"
                      editable={!loading}
                    />
                  </View>
                )}

                <View>
                  <Text className="text-sm text-muted-foreground mb-1">Email</Text>
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    editable={!loading}
                  />
                </View>

                <View>
                  <Text className="text-sm text-muted-foreground mb-1">Password</Text>
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    secureTextEntry
                    textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                    editable={!loading}
                  />
                </View>

                {error && (
                  <Text className="text-sm text-destructive">{error}</Text>
                )}

                <Button onPress={handleSubmit} disabled={loading || !email || !password}>
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</Text>
                  )}
                </Button>

                <View className="flex-row items-center gap-3">
                  <Separator className="flex-1" />
                  <Text className="text-xs text-muted-foreground">OR</Text>
                  <Separator className="flex-1" />
                </View>

                <Button variant="outline" onPress={handleGoogleSignIn} disabled={loading}>
                  <Text>Sign in with Google</Text>
                </Button>

                <Button variant="ghost" onPress={toggleMode} disabled={loading}>
                  <Text>
                    {mode === 'signin'
                      ? "Don't have an account? Sign Up"
                      : 'Already have an account? Sign In'}
                  </Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
