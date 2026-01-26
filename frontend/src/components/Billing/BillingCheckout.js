import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import api from '../../apiClient';

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (document.getElementById('razorpay-checkout-js')) return resolve(true);
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function BillingCheckout({ planSlug, seats, onDone }) {
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState('starting'); // starting | ready | paying | verifying | done | error
  const [error, setError] = useState('');
  const [orderPayload, setOrderPayload] = useState(null);

  const title = useMemo(() => {
    const name = planSlug === 'business' ? 'Business' : 'Pro';
    return `Checkout: ${name} (${seats} users)`;
  }, [planSlug, seats]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        setStatus('starting');
        setError('');

        const ok = await loadRazorpayScript();
        if (!ok) throw new Error('Failed to load Razorpay checkout script');

        const res = await api.post('/api/billing/checkout/order', {
          plan_slug: planSlug,
          seats,
        });

        if (cancelled) return;
        setOrderPayload(res.data);
        setStatus(res.data?.mock ? 'verifying' : 'ready');
      } catch (e) {
        if (cancelled) return;
        setError(e?.response?.data?.error || e?.message || 'Failed to start checkout');
        setStatus('error');
      }
    };

    start();
    return () => {
      cancelled = true;
    };
  }, [planSlug, seats]);

  useEffect(() => {
    if (!orderPayload?.mock) return;
    let cancelled = false;

    const runMock = async () => {
      try {
        const verifyRes = await api.post('/api/billing/checkout/verify', {
          razorpay_order_id: orderPayload.orderId,
        });
        if (cancelled) return;
        enqueueSnackbar('Mock payment successful. License activated.', { variant: 'success' });
        setStatus('done');
        onDone?.(verifyRes.data);
      } catch (e) {
        if (cancelled) return;
        setError(e?.response?.data?.error || e?.message || 'Mock payment failed');
        setStatus('error');
      }
    };

    runMock();
    return () => {
      cancelled = true;
    };
  }, [enqueueSnackbar, onDone, orderPayload]);

  const openCheckout = useCallback(() => {
    if (!orderPayload) return;
    if (orderPayload.mock) return;
    if (!window.Razorpay) {
      setError('Razorpay script did not initialize.');
      setStatus('error');
      return;
    }

    setStatus('paying');

    const options = {
      key: orderPayload.keyId,
      amount: orderPayload.amount,
      currency: orderPayload.currency,
      name: 'TeamFlow',
      description: `${orderPayload.plan?.name || planSlug} - ${seats} users - Monthly`,
      order_id: orderPayload.orderId,
      handler: async (response) => {
        try {
          setStatus('verifying');
          const verifyRes = await api.post('/api/billing/checkout/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          enqueueSnackbar('Payment successful. License activated.', { variant: 'success' });
          setStatus('done');
          onDone?.(verifyRes.data);
        } catch (e) {
          setError(e?.response?.data?.error || e?.message || 'Payment verification failed');
          setStatus('error');
        }
      },
      modal: {
        ondismiss: () => {
          setStatus('error');
          setError('Payment was cancelled.');
        },
      },
      theme: { color: '#0f766e' },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp) => {
      setStatus('error');
      setError(resp?.error?.description || 'Payment failed');
    });
    rzp.open();
  }, [enqueueSnackbar, onDone, orderPayload, planSlug, seats]);

  useEffect(() => {
    if (status === 'ready') openCheckout();
  }, [openCheckout, status]);

  return (
    <Backdrop open sx={{ color: '#fff', zIndex: (t) => t.zIndex.modal + 1 }}>
      <Paper
        elevation={8}
        sx={{
          width: 'min(560px, calc(100vw - 32px))',
          p: 3,
          borderRadius: 3,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          {title}
        </Typography>

        {(status === 'starting' || status === 'paying' || status === 'verifying') && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
            <CircularProgress size={22} />
            <Typography color="text.secondary">
              {status === 'starting' && 'Preparing payment...'}
              {status === 'paying' && 'Opening Razorpay...'}
              {status === 'verifying' && 'Verifying payment...'}
            </Typography>
          </Box>
        )}

        {status === 'error' && (
          <Box sx={{ mt: 2 }}>
            <Typography color="error" sx={{ mb: 1 }}>
              {error || 'Something went wrong'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => onDone?.({ cancelled: true })}
                sx={{ textTransform: 'none' }}
              >
                Close
              </Button>
              {orderPayload && (
                <Button variant="contained" onClick={openCheckout} sx={{ textTransform: 'none' }}>
                  Retry
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Paper>
    </Backdrop>
  );
}
