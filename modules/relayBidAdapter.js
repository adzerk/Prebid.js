import * as utils from '../src/utils.js';
import { config } from '../src/config.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';

const BIDDER_ENDPOINT = '//localhost:8080/openrtb2'
const SYNC_ENDPOINT = '//localhost:8080/u/set'

////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////// Request
////////////////////////////////////////////////////////////

/**
 * 
 * @param {*} validBidRequest 
 * @returns 
 */
const makeSource = (validBidRequest) => {
  const {transactionId, schain} = validBidRequest
  return {
    fd: 1,
    tid: transactionId,
    ext: {
      schain: {
        ver: '1.0',
        complete: 1,
        nodes: (schain || [])
      }
    }
  }
}

/**
 * 
 * @param {*} validBidRequest 
 * @returns 
 */
const makeImp = (validBidRequest) => {
  const {bidId, params, mediaTypes, adUnitCode} = validBidRequest
  utils.logMessage({trace: 'makeImp', bidId, params})

  const imps = []
  for (const mediaType in mediaTypes) {
    const newImp = {
      id: bidId,
      tagid: adUnitCode,
      ext: {
        a0x: {
          bidders: params
        }
      }
    }
    const currType = mediaTypes[mediaType]

    const formats = currType.sizes.map(([width, height]) => {
      return {w: width, h: height}
    })

    newImp[mediaType] = {
      format: formats,
    }
    imps.push(newImp)
  }

  return imps
}

/**
 * 
 * @param {*} navigatorPlatformStr 
 * @returns 
 */
const deviceHeuristic = (navigatorPlatformStr) => {
  const deviceTypes = {mobile: 1, pc: 2, phone: 4}
  const match = (str, needle) => {
    return str.indexOf(needle) > -1
  }

  const plat = navigatorPlatformStr.toLowerCase()
  const isPC = (
    match(plat, 'win') ||
    match(plat, 'mac') ||
    match(plat, 'x11') ||
    match(plat, 'linux')
  )
  const isPhone = (
    match(plat, 'iphone') ||
    match(plat, 'android') 
  )

  const type = isPhone && 'phone' ||
               isPC && 'pc' ||
               'mobile'

  return deviceTypes[type]
}

/**
 * 
 * @returns 
 */
const makeDevice = () => {
  const safeNavigator = (window||{}).navigator || {}
  const platform      = safeNavigator.platform || ''
  const userAgentStr  = safeNavigator.userAgent || ''
  const deviceType    = deviceHeuristic(platform)
  const langauge      = (safeNavigator.languages[1]||'').toUpperCase()
  const jsEnabled     = 1
  return {
    ua: userAgentStr,
    language: langauge,
    devicetype: deviceType,
    js: jsEnabled,
  }
}

/**
 * 
 * @returns 
 */
const makeSite = () => {
  const pubPage   = new URL(config.getConfig('publisherDomain')||'')
  const pubDomain = (pubPage||{}).host
  return {
    id: '0',
    page: pubPage,
    domain: pubDomain,
  }
}

/**
 * 
 * @param {*} validBidRequest 
 * @param {*} bidderRequest 
 * @returns 
 */
const makeUser = (validBidRequest, bidderRequest) => {
  utils.logMessage({trace: 'makeUser', validBidRequest})

  const newUser = {
    ext: {
      consent: (bidderRequest.gdprConsent||{}).consentString || ''
    }
  }
  // Add the (E)xtended User (Id)s. Current server implementation of OpenRT 2.5
  // does not look at this, but it could.
  if (validBidRequest.userIdAsEids) {
    newUser.ext.eids = validBidRequest.userIdAsEids
  }

  return newUser
}

/**
 * 
 * @param {*} bidderRequest 
 * @returns 
 */
const makeRegs = (bidderRequest) => {
  const coppaApplies = config.getConfig('coppa') || false
  const gdprApplies = (bidderRequest.gdprConsent||{}).gdprApplies || false
  const regs = {
    coppa: coppaApplies ? 1 : 0,
    ext: {
      gdpr: gdprApplies ? 1 : 0
    }
  }

  return regs
}

/**
 * 
 * @returns 
 */
const makeExt = () => {
  return {
    ssl: 1
  }
}

/**
 * 
 * @returns 
 */
const makeBadv = () => {
  return []
}

/**
 * 
 * @param {*} validBidRequest 
 * @param {*} bidderRequest 
 * @returns 
 */
const makeRelayRequest = (validBidRequest, bidderRequest) => {
  utils.logMessage({trace: 'makeRelayRequest', validBidRequest})

  let defaultRequest = {
    id:     validBidRequest.auctionId,
    source: makeSource(validBidRequest),
    imp:    makeImp(validBidRequest),
    badv:   makeBadv(),
    device: makeDevice(),
    site:   makeSite(),
    user:   makeUser(validBidRequest, bidderRequest),
    regs:   makeRegs(bidderRequest),
    at:     1,
    ext:    makeExt()
  }

  // Apply global and ad unit ortb2 configuration/context overwrites.
  const globalOrtb = config.getConfig("ortb2") || {}
  const adUnitOrtb = validBidRequest.ortb2Imp || {}
  defaultRequest = Object.assign(defaultRequest, globalOrtb, adUnitOrtb)
  return defaultRequest;
};


////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////// Response
////////////////////////////////////////////////////////////

/**
 * 
 * @param {*} obj 
 * @param {*} key 
 * @param {*} defaultValue 
 * @returns 
 */
const withDefault = (obj, key, defaultValue) => {
  return (obj || {})[key] || defaultValue;
}

/**
 * 
 * @param {*} bid 
 * @returns 
 */
const newBidResponse = (bid) => {
  utils.logMessage({trace: 'newBidResponse', bid})
  return {
    // Required fields must be present and contain a reasonable value.
    // <required>
    requestId: bid.impid,
    cpm: bid.price,
    currency: withDefault(bid, 'currency', "USD"),
    width: withDefault(bid, 'w', 300),
    height: withDefault(bid, 'h', 250),
    ad: bid.adm,
    ttl: withDefault(bid, 'ttl', 360),
    creativeId: bid.crid,
    netRevenue: true,
    // </required>
    // dealId: DEAL_ID,
    // mediaType: MEDIA_TYPE,
    // meta: {
      // advertiserDomains: [ARRAY_OF_ADVERTISER_DOMAINS],        
      // advertiserId: ADVERTISER_ID,
      // advertiserName: ADVERTISER_NAME,
      // agencyId: AGENCY_ID,
      // agencyName: AGENCY_NAME,
      // brandId: BRAND_ID,
      // brandName: BRAND_NAME,
      // dchain: DEMAND_CHAIN_OBJECT,
      // demandSource: DEMAND_SOURCE
      // mediaType: MEDIA_TYPE,
      // networkId: NETWORK_ID,
      // networkName: NETWORK_NAME,
      // primaryCatId: IAB_CATEGORY,
      // secondaryCatIds: [ARRAY_OF_IAB_CATEGORIES]
    // }
  };
}

////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////// Spec Interface
////////////////////////////////////////////////////////////

/**
 * 
 * @param {*} bid 
 * @returns 
 */
const isBidRequestValid = (bid) => {
  utils.logMessage({trace: 'isBidRequestValid', bid});
  try {
    return bid.params && bid.sizes.length > 0
  } catch(e) {
    utils.logMessage({trace: 'isBidRequestValid::exception', exception: e});
    return false
  }
};

/**
 * 
 * @param {*} validBidRequests 
 * @param {*} bidderRequest 
 * @returns 
 */
const buildRequests = (validBidRequests, bidderRequest) => {
  utils.logMessage({trace: 'buildRequests', validBidRequests, bidderRequest});
  return validBidRequests.map(
    (validBidRequest) => {
      utils.logMessage({trace: 'buildRequests::map'});
      let reqData = makeRelayRequest(validBidRequest, bidderRequest)
      return {
        method: 'POST',
        url: BIDDER_ENDPOINT,
        data: reqData,
      }
    }
  )
};

/**
 * 
 * @param {*} serverResponse 
 * @param {*} request 
 * @returns 
 */
const interpretResponse = (serverResponse, request) => {
  utils.logMessage({trace: 'interpretResponse', serverResponse, request});

  const seatBids = ((serverResponse||{}).body||{}).seatbid || [];
  utils.logMessage({seatBids});

  if (!seatBids.length) {
    return [];
  }

  return seatBids.flatMap((seat) => {
    return seat.bid.map((bid) => {
      utils.logMessage({trace: 'interpretResponse::seat.bid::map', bid});
      const bidResponse = newBidResponse(bid);
      utils.logMessage({bidResponse});
      return bidResponse
    })
  })
};

/**
 * 
 * @param {*} syncOptions 
 * @param {*} serverResponses 
 * @param {*} gdprConsent 
 * @param {*} uspConsent 
 * @returns 
 */
const getUserSyncs = (syncOptions, serverResponses, gdprConsent, uspConsent) => {
  utils.logMessage({trace: 'getUserSyncs', status: "Not implemented.", serverResponses, gdprConsent, uspConsent});

  return [];

}

/**
 * 
 * @param {*} timeoutData 
 */
const onTimeout = (timeoutData) => {
  utils.logMessage({trace: 'onTimeout', status: "Not implemented.", timeoutData});
};

/**
 * 
 * @param {*} bid 
 */
const onBidWon = (bid) => {
  utils.logMessage({trace: 'onBidWon', status: "Not implemented."});
};

/**
 * 
 * @param {*} bid 
 */
const onSetTargeting = (bid) => {
  utils.logMessage({trace: 'onSetTargeting', status: "Not implemented."});
};

//////////////////////////////////////////////////////////// 
//////////////////////////////////////////////////////////// Spec
//////////////////////////////////////////////////////////// 

const BIDDER_CODE = 'relay';
export const spec = {
  code: BIDDER_CODE,
  isBidRequestValid: isBidRequestValid,
  buildRequests: buildRequests,
  interpretResponse: interpretResponse,
  getUserSyncs: getUserSyncs,
  onTimeout: onTimeout,
  onBidWon: onBidWon,
  onSetTargeting: onSetTargeting
}
registerBidder(spec);
