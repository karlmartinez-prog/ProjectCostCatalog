import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://vbenebjngbksztbeegpu.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZW5lYmpuZ2Jrc3p0YmVlZ3B1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTU3NjMsImV4cCI6MjA5MTc3MTc2M30.1bXFbsrDvagaewVotElTEB-OOg9Bat6tFFucp8uXJe0"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)