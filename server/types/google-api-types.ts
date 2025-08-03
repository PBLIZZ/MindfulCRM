// Google Calendar API Types
// Based on Google Calendar API v3 specification

export interface GoogleCalendarEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  start?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  } | null;
  end?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  } | null;
  attendees?: GoogleEventAttendee[] | null;
  created?: string | null;
  updated?: string | null;
  status?: string | null;
  htmlLink?: string | null;
  organizer?: {
    email?: string | null;
    displayName?: string | null;
    self?: boolean | null;
  } | null;
  creator?: {
    email?: string | null;
    displayName?: string | null;
    self?: boolean | null;
  } | null;
  recurringEventId?: string | null;
  originalStartTime?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  } | null;
  transparency?: string | null;
  visibility?: string | null;
  iCalUID?: string | null;
  sequence?: number | null;
  hangoutLink?: string | null;
  conferenceData?: {
    createRequest?: {
      requestId?: string | null;
      conferenceSolutionKey?: {
        type?: string | null;
      } | null;
      status?: {
        statusCode?: string | null;
      } | null;
    } | null;
    entryPoints?: Array<{
      entryPointType?: string | null;
      uri?: string | null;
      label?: string | null;
      pin?: string | null;
      accessCode?: string | null;
      meetingCode?: string | null;
      passcode?: string | null;
      password?: string | null;
    }> | null;
    conferenceSolution?: {
      key?: {
        type?: string | null;
      } | null;
      name?: string | null;
      iconUri?: string | null;
    } | null;
    conferenceId?: string | null;
    signature?: string | null;
    notes?: string | null;
  } | null;
  gadget?: {
    type?: string | null;
    title?: string | null;
    link?: string | null;
    iconLink?: string | null;
    width?: number | null;
    height?: number | null;
    display?: string | null;
    preferences?: { [key: string]: string } | null;
  } | null;
  anyoneCanAddSelf?: boolean | null;
  guestsCanInviteOthers?: boolean | null;
  guestsCanModify?: boolean | null;
  guestsCanSeeOtherGuests?: boolean | null;
  privateCopy?: boolean | null;
  locked?: boolean | null;
  reminders?: {
    useDefault?: boolean | null;
    overrides?: Array<{
      method?: string | null;
      minutes?: number | null;
    }> | null;
  } | null;
  source?: {
    url?: string | null;
    title?: string | null;
  } | null;
  attachments?: Array<{
    fileUrl?: string | null;
    title?: string | null;
    mimeType?: string | null;
    iconLink?: string | null;
    fileId?: string | null;
  }> | null;
  eventType?: string | null;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  } | null;
  colorId?: string | null;
}

export interface GoogleEventAttendee {
  id?: string | null;
  email?: string | null;
  displayName?: string | null;
  organizer?: boolean | null;
  self?: boolean | null;
  resource?: boolean | null;
  optional?: boolean | null;
  responseStatus?: string | null;
  comment?: string | null;
  additionalGuests?: number | null;
}

export interface GoogleCalendarListEntry {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  timeZone?: string;
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  hidden?: boolean;
  selected?: boolean;
  accessRole?: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  defaultReminders?: Array<{
    method?: string;
    minutes?: number;
  }>;
  notificationSettings?: {
    notifications?: Array<{
      type?: string;
      method?: string;
    }>;
  };
  primary?: boolean;
  deleted?: boolean;
  conferenceProperties?: {
    allowedConferenceSolutionTypes?: string[];
  };
}

export interface GoogleCalendarEventsListResponse {
  kind?: string;
  etag?: string;
  summary?: string;
  description?: string;
  updated?: string;
  timeZone?: string;
  accessRole?: string;
  defaultReminders?: Array<{
    method?: string;
    minutes?: number;
  }>;
  nextPageToken?: string;
  nextSyncToken?: string;
  items?: GoogleCalendarEvent[];
}

export interface GoogleCalendarListResponse {
  kind?: string;
  etag?: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items?: GoogleCalendarListEntry[];
}

// Extended event type with our custom properties
export interface ExtendedGoogleCalendarEvent extends GoogleCalendarEvent {
  calendarId?: string | null;
  calendarName?: string | null;
  calendarColor?: string | null;
}

// Gmail API Types
export interface GmailMessage {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
  sizeEstimate?: number;
  raw?: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

export interface GmailHeader {
  name?: string;
  value?: string;
}

export interface GmailMessagesListResponse {
  messages?: Array<{
    id?: string;
    threadId?: string;
  }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

// Google Drive API Types
export interface GoogleDriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  explicitlyTrashed?: boolean;
  parents?: string[];
  properties?: Record<string, string>;
  appProperties?: Record<string, string>;
  spaces?: string[];
  version?: string;
  webContentLink?: string;
  webViewLink?: string;
  iconLink?: string;
  hasThumbnail?: boolean;
  thumbnailLink?: string;
  thumbnailVersion?: string;
  viewedByMe?: boolean;
  viewedByMeTime?: string;
  createdTime?: string;
  modifiedTime?: string;
  modifiedByMeTime?: string;
  modifiedByMe?: boolean;
  sharedWithMeTime?: string;
  sharingUser?: {
    kind?: string;
    displayName?: string;
    photoLink?: string;
    me?: boolean;
    permissionId?: string;
    emailAddress?: string;
  };
  owners?: Array<{
    kind?: string;
    displayName?: string;
    photoLink?: string;
    me?: boolean;
    permissionId?: string;
    emailAddress?: string;
  }>;
  teamDriveId?: string;
  driveId?: string;
  lastModifyingUser?: {
    kind?: string;
    displayName?: string;
    photoLink?: string;
    me?: boolean;
    permissionId?: string;
    emailAddress?: string;
  };
  shared?: boolean;
  ownedByMe?: boolean;
  capabilities?: {
    canAddChildren?: boolean;
    canAddFolderFromAnotherDrive?: boolean;
    canAddMyDriveParent?: boolean;
    canChangeCopyRequiresWriterPermission?: boolean;
    canChangeSecurityUpdateEnabled?: boolean;
    canChangeViewersCanCopyContent?: boolean;
    canComment?: boolean;
    canCopy?: boolean;
    canDelete?: boolean;
    canDeleteChildren?: boolean;
    canDownload?: boolean;
    canEdit?: boolean;
    canListChildren?: boolean;
    canModifyContent?: boolean;
    canModifyContentRestriction?: boolean;
    canMoveChildrenOutOfTeamDrive?: boolean;
    canMoveChildrenOutOfDrive?: boolean;
    canMoveChildrenWithinTeamDrive?: boolean;
    canMoveChildrenWithinDrive?: boolean;
    canMoveItemIntoTeamDrive?: boolean;
    canMoveItemOutOfTeamDrive?: boolean;
    canMoveItemOutOfDrive?: boolean;
    canMoveItemWithinTeamDrive?: boolean;
    canMoveItemWithinDrive?: boolean;
    canMoveTeamDriveItem?: boolean;
    canReadRevisions?: boolean;
    canReadTeamDrive?: boolean;
    canReadDrive?: boolean;
    canRemoveChildren?: boolean;
    canRemoveMyDriveParent?: boolean;
    canRename?: boolean;
    canShare?: boolean;
    canTrash?: boolean;
    canTrashChildren?: boolean;
    canUntrash?: boolean;
  };
  viewersCanCopyContent?: boolean;
  copyRequiresWriterPermission?: boolean;
  writersCanShare?: boolean;
  permissions?: Array<{
    id?: string;
    displayName?: string;
    type?: string;
    kind?: string;
    permissionDetails?: Array<{
      permissionType?: string;
      role?: string;
      inheritedFrom?: string;
      inherited?: boolean;
    }>;
    photoLink?: string;
    emailAddress?: string;
    role?: string;
    allowFileDiscovery?: boolean;
    domain?: string;
    expirationTime?: string;
    teamDrivePermissionDetails?: Array<{
      teamDrivePermissionType?: string;
      role?: string;
      inheritedFrom?: string;
      inherited?: boolean;
    }>;
    deleted?: boolean;
    pendingOwner?: boolean;
  }>;
  permissionIds?: string[];
  hasAugmentedPermissions?: boolean;
  folderColorRgb?: string;
  originalFilename?: string;
  fullFileExtension?: string;
  fileExtension?: string;
  md5Checksum?: string;
  sha1Checksum?: string;
  sha256Checksum?: string;
  size?: string;
  quotaBytesUsed?: string;
  headRevisionId?: string;
  contentHints?: {
    thumbnail?: {
      image?: string;
      mimeType?: string;
    };
    indexableText?: string;
  };
  imageMediaMetadata?: {
    width?: number;
    height?: number;
    rotation?: number;
    location?: {
      latitude?: number;
      longitude?: number;
      altitude?: number;
    };
    time?: string;
    cameraMake?: string;
    cameraModel?: string;
    exposureTime?: number;
    aperture?: number;
    flashUsed?: boolean;
    focalLength?: number;
    isoSpeed?: number;
    meteringMode?: string;
    sensor?: string;
    exposureMode?: string;
    colorSpace?: string;
    whiteBalance?: string;
    exposureBias?: number;
    maxApertureValue?: number;
    subjectDistance?: number;
    lens?: string;
  };
  videoMediaMetadata?: {
    width?: number;
    height?: number;
    durationMillis?: string;
  };
  isAppAuthorized?: boolean;
  exportLinks?: Record<string, string>;
  shortcutDetails?: {
    targetId?: string;
    targetMimeType?: string;
    targetResourceKey?: string;
  };
  contentRestrictions?: Array<{
    readOnly?: boolean;
    reason?: string;
    restrictingUser?: {
      kind?: string;
      displayName?: string;
      photoLink?: string;
      me?: boolean;
      permissionId?: string;
      emailAddress?: string;
    };
    restrictionTime?: string;
    type?: string;
  }>;
  resourceKey?: string;
  linkShareMetadata?: {
    securityUpdateEligible?: boolean;
    securityUpdateEnabled?: boolean;
  };
  labelInfo?: {
    labels?: Array<{
      id?: string;
      revisionId?: string;
      kind?: string;
      fields?: Record<string, unknown>;
    }>;
  };
}

export interface GoogleDriveFilesListResponse {
  kind?: string;
  incompleteSearch?: boolean;
  nextPageToken?: string;
  files?: GoogleDriveFile[];
}
