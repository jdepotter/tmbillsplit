import React from 'react'

type P = { size?: number }

export const GridIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 16 16" fill="currentColor" width={size} height={size}>
    <rect x="1" y="1" width="6" height="6" rx="1.5" />
    <rect x="9" y="1" width="6" height="6" rx="1.5" />
    <rect x="1" y="9" width="6" height="6" rx="1.5" />
    <rect x="9" y="9" width="6" height="6" rx="1.5" />
  </svg>
)

export const UserIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 16 16" fill="currentColor" width={size} height={size}>
    <circle cx="8" cy="4.5" r="2.5" />
    <path d="M2 13.5C2 11.01 4.686 9 8 9s6 2.01 6 4.5H2z" />
  </svg>
)

export const FileIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 16 16" fill="currentColor" width={size} height={size}>
    <path d="M14 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2h5.5L14 4.5zm-3 0A1.5 1.5 0 019.5 3V1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V4.5h-2z" />
  </svg>
)

export const PhoneIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 16 16" fill="currentColor" width={size} height={size}>
    <path d="M3.925 1.105a.5.5 0 00-.61-.333L1.15 1.361A1 1 0 00.5 2.32C.5 9.592 6.408 15.5 13.68 15.5a1 1 0 00.96-.65l.588-2.165a.5.5 0 00-.334-.611l-3-1a.5.5 0 00-.544.165l-1.2 1.6a7.54 7.54 0 01-3.99-3.99l1.6-1.2a.5.5 0 00.165-.544l-1-3z"/>
  </svg>
)

export const PeopleIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 16 16" fill="currentColor" width={size} height={size}>
    <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0z" />
    <path fillRule="evenodd" d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-7a7 7 0 100 14A7 7 0 008 1z" />
  </svg>
)

export const HomeIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 16 16" fill="currentColor" width={size} height={size}>
    <path d="M8.354 1.146a.5.5 0 00-.708 0l-6 6-.146.147V14.5A1.5 1.5 0 003 16h3.5v-4.5h3V16H13a1.5 1.5 0 001.5-1.5V7.293l-.146-.147-6-6z"/>
  </svg>
)

export const DownloadIcon = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

export const UploadIcon = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

export const ReparseIcon = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
)

export const TrashIcon = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
)

export const ExternalLinkIcon = ({ size = 13 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

export const UploadCloudIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--mg)" strokeWidth="1.5">
    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
)
