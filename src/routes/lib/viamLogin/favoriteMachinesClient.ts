import { MethodKind } from '@bufbuild/protobuf'
import { createClient, type Interceptor } from '@connectrpc/connect'
import { createGrpcWebTransport } from '@connectrpc/connect-web'
import { appApi } from '@viamrobotics/sdk'

const APP_SERVICE_HOST = 'https://app.viam.com'

/**
 * The favorite-machine slice of `viam.app.v1.AppService`, matching the generated descriptor in
 * `@viamrobotics/sdk` 0.79. The SDK exports the messages but neither this descriptor nor an
 * `AppClient` method for it, so it is declared here until the SDK ships favorites support.
 */
const FavoriteMachinesService = {
	typeName: 'viam.app.v1.AppService',
	methods: {
		listFavoriteMachines: {
			name: 'ListFavoriteMachines',
			I: appApi.ListFavoriteMachinesRequest,
			O: appApi.ListFavoriteMachinesResponse,
			kind: MethodKind.Unary,
		},
		addFavoriteMachine: {
			name: 'AddFavoriteMachine',
			I: appApi.AddFavoriteMachineRequest,
			O: appApi.AddFavoriteMachineResponse,
			kind: MethodKind.Unary,
		},
		removeFavoriteMachine: {
			name: 'RemoveFavoriteMachine',
			I: appApi.RemoveFavoriteMachineRequest,
			O: appApi.RemoveFavoriteMachineResponse,
			kind: MethodKind.Unary,
		},
	},
} as const

/**
 * A client for the user's favorite machines on app.viam.com. Authenticates the way the SDK's own
 * app transport does for an access token: gRPC-web with a bearer header.
 */
export const createFavoriteMachinesClient = (accessToken: string) => {
	const bearerAuth: Interceptor = (next) => (request) => {
		request.header.set('authorization', `Bearer ${accessToken}`)
		return next(request)
	}
	return createClient(
		FavoriteMachinesService,
		createGrpcWebTransport({ baseUrl: APP_SERVICE_HOST, interceptors: [bearerAuth] })
	)
}
