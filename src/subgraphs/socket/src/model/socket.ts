import { model, Schema } from 'mongoose';
import { ISocketDocument, ISocketModel } from '../type';
import { Enum } from '../util';

export const ISOCode = Enum({
  De: 'DE',
  In: 'IN',
});

export const ContinentCode = Enum({
  As: 'AS',
  Eu: 'EU',
});

export const CountryTitle = Enum({
  Germany: 'Germany',
  India: 'India',
});

export const DataProviderStatusTypeTitle = Enum({
  AutomatedImport: 'Automated Import',
  ManualDataEntry: 'Manual Data Entry',
});

export const DataProviderTitle = Enum({
  BundesnetzagenturDe: 'Bundesnetzagentur.de',
  OpenChargeMapContributors: 'Open Charge Map Contributors',
  Oplaadpalennl: 'Oplaadpalen.nl',
});

export const FormalName = Enum({
  BS1363TypeG: 'BS1363 / Type G',
  Cee74: 'CEE 7/4',
  IEC603093Pin: 'IEC 60309 3-pin',
  IEC621962: 'IEC 62196-2',
  IEC621962Type2: 'IEC 62196-2 Type 2',
  IEC621963ConfigurationAA: 'IEC 62196-3 Configuration AA',
  IEC621963ConfigurationFF: 'IEC 62196-3 Configuration FF',
  IECTypeMSANS1641IS12932005: 'IEC Type M (SANS 164-1, IS 1293:2005)',
  NotSpecified: 'Not Specified',
  SaeJ17722009: 'SAE J1772-2009',
  NACS: 'NACS',
  TypeIAS3122CPSCCC: 'Type I/AS 3112/CPCS-CCC',
  TeslaConnector: 'Tesla Connector',
  Europlug2PinCEE716: 'Europlug 2-Pin (CEE 7/16)',
  IEC621963ConfigurationEE: 'IEC 62196-3 Configuration EE',
});

export const StatusTypeTitle = Enum({
  Operational: 'Operational',
  PlannedForFutureDate: 'Planned For Future Date',
  Unknown: 'Unknown',
  NotOperational: 'Not Operational',
  TemporarilyUnavailable: 'Temporarily Unavailable',
  RemovedDuplicateListing: 'Removed (Duplicate Listing)',
  PartlyOperationalMixed: 'Partly Operational (Mixed)',
  RemovedDecommissioned: 'Removed (Decommissioned)',
  CurrentlyAvailableAutomatedStatus: 'Currently Available (Automated Status)',
});

export const Comments = Enum({
  Over2KWUsuallyNonDomesticSocketType: 'Over 2 kW, usually non-domestic socket type',
  The40KWAndHigher: '40KW and Higher',
  Under2KWUsuallyDomesticSocketTypes: 'Under 2 kW, usually domestic socket types',
});

export const LevelTitle = Enum({
  Level1LowUnder2KW: 'Level 1 : Low (Under 2kW)',
  Level2MediumOver2KW: 'Level 2 : Medium (Over 2kW)',
  Level3HighOver40KW: 'Level 3:  High (Over 40kW)',
});

export const Description = Enum({
  AlternatingCurrentSinglePhase: 'Alternating Current - Single Phase',
  AlternatingCurrentThreePhase: 'Alternating Current - Three Phase',
  DirectCurrent: 'Direct Current',
});

export const CurrentTypeTitle = Enum({
  ACSinglePhase: 'AC (Single-Phase)',
  ACThreePhase: 'AC (Three-Phase)',
  Dc: 'DC',
});

const pointSchema = new Schema(
  {
    type: {
      type: Schema.Types.String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Schema.Types.Number],
    },
  },
  { _id: false },
);

const socketSchema = new Schema(
  {
    serial: {
      type: Schema.Types.Number,
      required: true,
      unique: true,
      index: true,
    },
    uuid: {
      type: Schema.Types.UUID,
      required: true,
      unique: true,
      index: true,
    },
    operatorInfo: {
      websiteURL: {
        type: Schema.Types.String,
      },
      comments: {
        type: Schema.Types.String,
      },
      phonePrimaryContact: {
        type: Schema.Types.String,
      },
      phoneSecondaryContact: {
        type: Schema.Types.String,
      },
      isPrivateIndividual: {
        type: Schema.Types.Boolean,
      },
      // addressInfo: null,
      // bookingURL: null,
      contactEmail: {
        type: Schema.Types.String,
      },
      faultReportEmail: {
        type: Schema.Types.String,
      },
      isRestrictedEdit: {
        type: Schema.Types.Boolean,
      },
      id: {
        type: Schema.Types.Number,
      },
      title: {
        type: Schema.Types.String,
      },
    },
    statusType: {
      isOperational: {
        type: Schema.Types.Boolean,
      },
      isUserSelectable: {
        type: Schema.Types.Boolean,
      },
      id: {
        type: Schema.Types.Number,
      },
      title: {
        type: Schema.Types.String,
        enum: Object.values(StatusTypeTitle),
      },
    },
    addressInfo: {
      id: {
        type: Schema.Types.Number,
      },
      title: {
        type: Schema.Types.String,
      },
      addressLine1: {
        type: Schema.Types.String,
      },
      addressLine2: {
        type: Schema.Types.String,
      },
      town: {
        type: Schema.Types.String,
      },
      stateOrProvince: {
        type: Schema.Types.String,
      },
      postcode: {
        type: Schema.Types.String,
      },
      countryID: {
        type: Schema.Types.Number,
      },
      country: {
        isoCode: {
          type: Schema.Types.String,
          enum: Object.values(ISOCode),
        },
        continentCode: {
          type: Schema.Types.String,
          enum: Object.values(ContinentCode),
        },
        id: {
          type: Schema.Types.Number,
        },
        title: {
          type: Schema.Types.String,
          enum: Object.values(CountryTitle),
        },
      },
      latitude: {
        type: Schema.Types.Number,
      },
      longitude: {
        type: Schema.Types.Number,
      },
      contactTelephone1: {
        type: Schema.Types.String,
      },
      contactTelephone2: {
        type: Schema.Types.String,
      },
      contactEmail: {
        type: Schema.Types.String,
      },
      accessComments: {
        type: Schema.Types.String,
      },
      relatedURL: {
        type: Schema.Types.String,
      },
      // distance: null
      distanceUnit: {
        type: Schema.Types.Number,
      },
    },
    location: {
      type: pointSchema,
      index: '2dsphere',
    },
    dataProvider: {
      websiteURL: {
        type: Schema.Types.String,
      },
      // comments: null,
      dataProviderStatusType: {
        isProviderEnabled: {
          type: Schema.Types.Boolean,
        },
        id: {
          type: Schema.Types.Number,
        },
        title: {
          type: Schema.Types.String,
          enum: Object.values(DataProviderStatusTypeTitle),
        },
      },
      isRestrictedEdit: {
        type: Schema.Types.Boolean,
      },
      isOpenDataLicensed: {
        type: Schema.Types.Boolean,
      },
      isApprovedImport: {
        type: Schema.Types.Boolean,
      },
      license: {
        type: Schema.Types.String,
      },
      dateLastImported: {
        type: Schema.Types.Date,
      },
      id: {
        type: Schema.Types.Number,
      },
      title: {
        type: Schema.Types.String,
        enum: Object.values(DataProviderTitle),
      },
    },
    connections: [
      {
        id: {
          type: Schema.Types.Number,
        },
        connectionTypeID: {
          type: Schema.Types.Number,
        },
        connectionType: {
          formalName: {
            type: Schema.Types.String,
            enum: Object.values(FormalName),
          },
          isDiscontinued: {
            type: Schema.Types.Boolean,
          },
          isObsolete: {
            type: Schema.Types.Boolean,
          },
          id: {
            type: Schema.Types.Number,
          },
          title: {
            type: Schema.Types.String,
          },
        },
        reference: {
          type: Schema.Types.String,
        },
        statusTypeID: {
          type: Schema.Types.Number,
        },
        statusType: {
          isOperational: {
            type: Schema.Types.Boolean,
          },
          isUserSelectable: {
            type: Schema.Types.Boolean,
          },
          id: {
            type: Schema.Types.Number,
          },
          title: {
            type: Schema.Types.String,
            enum: Object.values(StatusTypeTitle),
          },
        },
        levelID: {
          type: Schema.Types.Number,
        },
        level: {
          comments: {
            type: Schema.Types.String,
            enum: Object.values(Comments),
          },
          isFastChargeCapable: {
            type: Schema.Types.Boolean,
          },
          id: {
            type: Schema.Types.Number,
          },
          title: {
            type: Schema.Types.String,
            enum: Object.values(LevelTitle),
          },
        },
        amps: {
          type: Schema.Types.Number,
        },
        voltage: {
          type: Schema.Types.Number,
        },
        powerKW: {
          type: Schema.Types.Number,
        },
        currentTypeID: {
          type: Schema.Types.Number,
        },
        currentType: {
          description: {
            type: Schema.Types.String,
            enum: Object.values(Description),
          },
          id: {
            type: Schema.Types.Number,
          },
          title: {
            type: Schema.Types.String,
            enum: Object.values(CurrentTypeTitle),
          },
        },
        quantity: {
          type: Schema.Types.Number,
        },
        comments: {
          type: Schema.Types.String,
        },
      },
    ],
    dateCreated: {
      type: Schema.Types.Date,
    },
    dateLastVerified: {
      type: Schema.Types.Date,
    },
    dateLastStatusUpdate: {
      type: Schema.Types.Date,
      required: true,
    },
    createdAt: Schema.Types.Number,
    updatedAt: Schema.Types.Number,
  },
  {
    // Make Mongoose use Unix time (seconds since Jan 1, 1970)
    timestamps: { currentTime: (): number => Math.floor(Date.now() / 1000) },
  },
);

socketSchema.set('toObject', { getters: true });

const Socket = model<ISocketDocument, ISocketModel>('Socket', socketSchema);

export default Socket;
