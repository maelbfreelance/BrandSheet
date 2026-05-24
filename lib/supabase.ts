import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://aczakaoncltqrgxmlpxn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjemFrYW9uY2x0cXJneG1scHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODUxNDUsImV4cCI6MjA5NTE2MTE0NX0.cKTkOlbxweCrvijLXl0kQKM4ALbaz4u1z-wUFclzC8s'
)