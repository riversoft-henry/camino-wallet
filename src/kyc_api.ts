import axios, { AxiosInstance } from 'axios'
import sha3 from 'js-sha3'
let elliptic = require('elliptic')
let ec = new elliptic.ec('secp256k1')
export interface AccessToken {
    access_token: string
}
interface GetNonceType {
    nonce: string
}

const BASE_URL = 'https://api.kyc.camino.network/v2'

const kyc_api: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: false,
    headers: {
        'Content-Type': 'application/json',
    },
})

async function getNonce(): Promise<GetNonceType> {
    let res = await kyc_api.get('/nonce')
    return res.data
}

async function generateToken(privateKey: string): Promise<AccessToken> {
    let keyPair = ec.keyFromPrivate(privateKey)
    let privKey = keyPair.getPrivate('hex')
    let pubKey = keyPair.getPublic()
    let { nonce } = await getNonce()
    let msgHash = sha3.keccak_256(Buffer.from(nonce, 'hex'))
    let signature = ec.sign(msgHash, privKey, 'hex', { canonical: true })
    let req = {
        nonce: nonce,
        signature: Buffer.concat([
            signature.r.toArrayLike(Buffer, 'be', 32),
            signature.s.toArrayLike(Buffer, 'be', 32),
            Buffer.from([signature.recoveryParam]),
        ]).toString('hex'),
        public_key: pubKey.encode('hex', false),
    }
    let res = await kyc_api.post('/accessToken', req)
    return res.data
}

async function checkVerificationStatus(
    privateKey: string,
    activeNetworkName: string
): Promise<boolean> {
    let keyPair = ec.keyFromPrivate(privateKey)
    let pubKey = keyPair.getPublic()
    let url = `/verified/${activeNetworkName}/${pubKey.encode('hex', false)}`

    let res = await kyc_api.get(url)
    return res.data.kyc_verified
}

export { kyc_api, generateToken, checkVerificationStatus }
