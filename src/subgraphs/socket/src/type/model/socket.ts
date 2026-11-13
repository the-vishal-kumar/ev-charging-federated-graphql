import { Document, Model, Types } from 'mongoose';

export interface ISocketDocument extends ISocket, Document {}

export type ISocketModel = Model<ISocketDocument>;

/** A document as returned by `.lean()`: uuid is a bson UUID, not a string. */
export interface ISocketLean extends Omit<ISocket, 'uuid'> {
  _id: Types.ObjectId;
  uuid: unknown;
}

/** The shape handed to GraphQL field resolvers. */
export interface ISocketNode extends Omit<ISocket, 'uuid' | 'location'> {
  identifier: string;
  uuid: string;
}

export interface IPoint {
  type: string;
  coordinates: [number, number];
}

export interface ISocket {
  serial: number;
  uuid: string;
  operatorInfo: IOperatorInfo | null;
  statusType: IStatusType;
  addressInfo: IAddressInfo;
  location: IPoint;
  dataProvider: IDataProvider;
  connections: IConnection[];
  dateCreated: Date;
  dateLastVerified: Date;
  dateLastStatusUpdate: Date;
}

export interface IOperatorInfo {
  websiteURL: null | string;
  comments: null | string;
  phonePrimaryContact: null | string;
  phoneSecondaryContact: null | string;
  isPrivateIndividual: boolean | null;
  addressInfo: null;
  bookingURL: null;
  contactEmail: null | string;
  faultReportEmail: null | string;
  isRestrictedEdit: boolean | null;
  id: number;
  title: string;
}

export interface IAddressInfo {
  id: number;
  title: string;
  addressLine1: string;
  addressLine2: null | string;
  town: null | string;
  stateOrProvince: null | string;
  postcode: null | string;
  countryID: number;
  country: ICountry;
  latitude: number;
  longitude: number;
  contactTelephone1: null | string;
  contactTelephone2: null | string;
  contactEmail: null | string;
  accessComments: null | string;
  relatedURL: null | string;
  // distance: null;
  // distanceUnit: number;
}

export interface ICountry {
  isoCode: IISOCode;
  continentCode: IContinentCode;
  id: number;
  title: ICountryTitle;
}

export enum IISOCode {
  DE = 'DE',
  IN = 'IN',
}

export enum IContinentCode {
  AS = 'AS',
  EU = 'EU',
}

export enum ICountryTitle {
  GERMANY = 'Germany',
  INDIA = 'India',
}

export interface IDataProvider {
  websiteURL: string;
  comments: null;
  dataProviderStatusType: IDataProviderStatusType;
  isRestrictedEdit: boolean;
  isOpenDataLicensed: boolean;
  isApprovedImport: boolean;
  license: string;
  dateLastImported: Date | null;
  id: number;
  title: IDataProviderTitle;
}

export interface IDataProviderStatusType {
  isProviderEnabled: boolean;
  id: number;
  title: IDataProviderStatusTypeTitle;
}

export enum IDataProviderStatusTypeTitle {
  AutomatedImport = 'Automated Import',
  ManualDataEntry = 'Manual Data Entry',
}

export enum IDataProviderTitle {
  BundesnetzagenturDe = 'Bundesnetzagentur.de',
  OpenChargeMapContributors = 'Open Charge Map Contributors',
  Oplaadpalennl = 'Oplaadpalen.nl',
}

export interface IConnection {
  id: number;
  connectionTypeID: number;
  connectionType: IConnectionType;
  reference: null | string;
  statusTypeID: number | null;
  statusType: IStatusType | null;
  levelID: number | null;
  level: ILevel | null;
  amps: number | null;
  voltage: number | null;
  powerKW: number | null;
  currentTypeID: number | null;
  currentType: ICurrentType | null;
  quantity: number | null;
  comments: null | string;
}

export interface IConnectionType {
  formalName: IFormalName | null;
  isDiscontinued: boolean | null;
  isObsolete: boolean | null;
  id: number;
  title: string;
}

export enum IFormalName {
  BS1363TypeG = 'BS1363 / Type G',
  Cee74 = 'CEE 7/4',
  IEC603093Pin = 'IEC 60309 3-pin',
  IEC621962 = 'IEC 62196-2',
  IEC621962Type2 = 'IEC 62196-2 Type 2',
  IEC621963ConfigurationAA = 'IEC 62196-3 Configuration AA',
  IEC621963ConfigurationFF = 'IEC 62196-3 Configuration FF',
  IECTypeMSANS1641IS12932005 = 'IEC Type M (SANS 164-1, IS 1293:2005)',
  NotSpecified = 'Not Specified',
  SaeJ17722009 = 'SAE J1772-2009',
  NACS = 'NACS',
  TypeIAS3122CPSCCC = 'Type I/AS 3112/CPCS-CCC',
  TeslaConnector = 'Tesla Connector',
  Europlug2PinCEE716 = 'Europlug 2-Pin (CEE 7/16)',
  IEC621963ConfigurationEE = 'IEC 62196-3 Configuration EE',
}

export interface ILevel {
  comments: IComments;
  isFastChargeCapable: boolean;
  id: number;
  title: ILevelTitle;
}

export enum IComments {
  Over2KWUsuallyNonDomesticSocketType = 'Over 2 kW, usually non-domestic socket type',
  The40KWAndHigher = '40KW and Higher',
  Under2KWUsuallyDomesticSocketTypes = 'Under 2 kW, usually domestic socket types',
}

export enum ILevelTitle {
  Level1LowUnder2KW = 'Level 1 : Low (Under 2kW)',
  Level2MediumOver2KW = 'Level 2 : Medium (Over 2kW)',
  Level3HighOver40KW = 'Level 3:  High (Over 40kW)',
}

export interface ICurrentType {
  description: IDescription;
  id: number;
  title: ICurrentTypeTitle;
}

export enum IDescription {
  AlternatingCurrentSinglePhase = 'Alternating Current - Single Phase',
  AlternatingCurrentThreePhase = 'Alternating Current - Three Phase',
  DirectCurrent = 'Direct Current',
}

export enum ICurrentTypeTitle {
  ACSinglePhase = 'AC (Single-Phase)',
  ACThreePhase = 'AC (Three-Phase)',
  Dc = 'DC',
}

export interface IStatusType {
  isOperational: boolean | null;
  isUserSelectable: boolean;
  id: number;
  title: IStatusTypeTitle;
}

export enum IStatusTypeTitle {
  Operational = 'Operational',
  PlannedForFutureDate = 'Planned For Future Date',
  Unknown = 'Unknown',
  NotOperational = 'Not Operational',
  TemporarilyUnavailable = 'Temporarily Unavailable',
  RemovedDuplicateListing = 'Removed (Duplicate Listing)',
  PartlyOperationalMixed = 'Partly Operational (Mixed)',
  RemovedDecommissioned = 'Removed (Decommissioned)',
  CurrentlyAvailableAutomatedStatus = 'Currently Available (Automated Status)',
}
