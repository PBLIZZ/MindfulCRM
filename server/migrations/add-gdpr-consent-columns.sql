-- Migration: Add GDPR consent columns to users table
-- Date: 2025-08-01

-- Add GDPR consent columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS allow_profile_picture_scraping BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gdpr_consent_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS gdpr_consent_version TEXT DEFAULT '1.0';

-- Add GDPR and profile picture scraping columns to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS has_gdpr_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gdpr_consent_form_path TEXT,
ADD COLUMN IF NOT EXISTS social_media_handles JSONB,
ADD COLUMN IF NOT EXISTS profile_picture_source TEXT,
ADD COLUMN IF NOT EXISTS profile_picture_scraped_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS sex TEXT;

-- Add the allowProfilePictureScraping column to contacts table for filtering
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS allow_profile_picture_scraping BOOLEAN DEFAULT false;

-- Update existing users to have null GDPR consent
UPDATE users SET 
  allow_profile_picture_scraping = false,
  gdpr_consent_date = NULL,
  gdpr_consent_version = '1.0'
WHERE allow_profile_picture_scraping IS NULL;

-- Update existing contacts
UPDATE contacts SET 
  has_gdpr_consent = false,
  allow_profile_picture_scraping = false
WHERE has_gdpr_consent IS NULL;
