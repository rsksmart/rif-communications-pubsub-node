import config from "config"
import jwt from 'jsonwebtoken'
import { loggingFactory } from '../../logger'

type GRPCApiHandler = (...args: any[]) => void

const logger = loggingFactory('authorization')

export const isAuthorized = (call: any): boolean => {
  if (!call.metadata._internal_repr.authorization == null) {
    return false
  }

  try {
    return Boolean(jwt.verify(
        call.metadata._internal_repr.authorization.toString(),
        config.get<string>('authorization.secret')
    ))
  } catch (e) {
    logger.debug('JWT token verification error', e)
    return false
  }
}

/**
 * Generate JWT token based on RSK address
 * secret and expiration of token configurable from node-config
 * @param rskAddress
 */
export const generateToken = (rskAddress: string): string => {
  return jwt.sign(
      {
        rskAddress
      },
      config.get<string>('authorization.secret'),
      { expiresIn: config.get<string>('authorization.expiresIn') }
  )
}

/**
 * Auth Middleware for API handlers
 * @param handler
 */
export const secureRoute = (handler: GRPCApiHandler) => async (...args: any) => {
  const [call, callback] = args

  if (!isAuthorized(call)) {
    const error = { code: grpc.status.UNAUTHENTICATED, message: 'Not authorized' }
    if (callback) {
      callback(error)
    } else {
      call.write(error)
      call.end()
    }
    return
  }

  await handler(...args)
}
