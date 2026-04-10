-- Allow professionals to update their own record (name, phone, etc.)
CREATE POLICY "professional_update_self"
  ON public.professionals FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Allow professionals to delete their own notifications
CREATE POLICY "professional_delete_own_notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      WHERE p.id = recipient_professional_id AND p.auth_user_id = auth.uid()
    )
  );
