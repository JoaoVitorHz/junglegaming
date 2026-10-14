import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AvatarUpdate, PasswordChange, ProfileUpdate, User, Wallet, WalletInput, WalletRole } from '@/api/contracts'
import { profileApi, walletsApi } from '@/api/services'
import { sessionStore } from '@/auth/session-store'
import { useCurrentUser } from '@/auth/use-session'
import { queryKeys } from './keys'

function useUserId() {
  return useCurrentUser()?.id ?? 'anonymous'
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.private.profile(userId),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: userId !== 'anonymous',
  })
}

export function useWallets() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.private.wallets(userId),
    queryFn: async ({ signal }) => (await walletsApi.list({ signal })).items,
    enabled: userId !== 'anonymous',
  })
}

/** Toda alteração de perfil confirmada atualiza o cache e os dados públicos da sessão. */
function useProfileMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<User>) {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.private.profile(userId), user)
      sessionStore.updateUser(user)
    },
  })
}

export function useUpdateProfile() {
  return useProfileMutation((body: ProfileUpdate) => profileApi.update(body))
}

export function useUpdateAvatar() {
  return useProfileMutation((body: AvatarUpdate) => profileApi.updateAvatar(body))
}

export function useRemoveAvatar() {
  return useProfileMutation(() => profileApi.removeAvatar())
}

export function useChangePassword() {
  return useMutation({ mutationFn: (body: PasswordChange) => profileApi.changePassword(body) })
}

export function useSaveWallet() {
  const userId = useUserId()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ role, body }: { role: WalletRole; body: WalletInput }) => walletsApi.save(role, body),
    onSuccess: (wallet) => {
      queryClient.setQueryData<Wallet[]>(queryKeys.private.wallets(userId), (list = []) =>
        [...list.filter((w) => w.role !== wallet.role), wallet].sort((a) => (a.role === 'primary' ? -1 : 1)),
      )
    },
  })
}
