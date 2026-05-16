-- Allow anonymous (widget) read of the pre_orders module flag only
CREATE POLICY "anon read pre_orders module"
ON public.restaurant_modules
FOR SELECT
TO anon
USING (module_key = 'pre_orders');