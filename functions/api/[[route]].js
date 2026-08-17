// Cloudflare Pages Functions API Handler
// Re-export the Durable Object class so Cloudflare's runtime can register it.
export { BarberHubDO } from './durable-objects/BarberHubDO.js';

// ─── Internal helper: fan-out an event to all connected WebSocket clients ──────
// Called after every D1 mutation so browsers receive push events instantly.
async function broadcastEvent(env, type, payload) {
  try {
    if (!env.BARBER_HUB) return; // binding not configured (local dev)
    const id = env.BARBER_HUB.idFromName('GLOBAL');
    const stub = env.BARBER_HUB.get(id);
    await stub.fetch('https://internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, timestamp: Date.now() }),
    });
  } catch (err) {
    // Non-fatal — broadcast failure should never break the REST response
    console.warn('broadcastEvent failed:', err.message);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // ─── ROUTE: WebSocket Upgrade (Real-time hub) ─────────────────────────────
  // The browser connects here; we forward the upgrade to the Durable Object.
  if (path === '/ws') {
    if (!env.BARBER_HUB) {
      return new Response(
        JSON.stringify({ error: 'Durable Object binding (BARBER_HUB) not configured.' }),
        { status: 503, headers }
      );
    }
    const id = env.BARBER_HUB.idFromName('GLOBAL');
    const stub = env.BARBER_HUB.get(id);
    // Forward the raw WebSocket upgrade request directly to the DO
    return stub.fetch(new Request('https://internal/ws', request));
  }

  // Check if D1 database binding is present
  if (!env || !env.DB) {
    return new Response(JSON.stringify({
      error: 'Database binding (DB) not configured. Please bind a Cloudflare D1 database.',
      success: false
    }), { status: 500, headers });
  }

  try {
    // ---------------- HELPER: Parse JSON Body ----------------
    let body = {};
    if (request.method === 'POST' || request.method === 'PUT') {
      try {
        body = await request.json();
      } catch (e) {
        body = {};
      }
    }

    // ---------------- ROUTE: BARBERS ----------------
    if (path === '/barbers') {
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM barbers').all();
        // Parse JSON fields
        const formatted = results.map(b => ({
          ...b,
          workDays: b.workDays ? JSON.parse(b.workDays) : [],
          isOff: b.isOff === 1,
          rating: Number(b.rating)
        }));
        return new Response(JSON.stringify(formatted), { headers });
      }

      if (request.method === 'POST') {
        const { id, name, title, avatar, workDays, workStart, workEnd, isOff, rating } = body;
        const workDaysStr = JSON.stringify(workDays || []);
        const isOffInt = isOff ? 1 : 0;
        const finalRating = rating !== undefined ? Number(rating) : 5.0;

        // Check if barber exists
        const existing = await env.DB.prepare('SELECT id FROM barbers WHERE id = ?').bind(id).first();

        if (existing) {
          await env.DB.prepare(
            'UPDATE barbers SET name = ?, title = ?, avatar = ?, workDays = ?, workStart = ?, workEnd = ?, isOff = ?, rating = ? WHERE id = ?'
          ).bind(name, title, avatar, workDaysStr, workStart, workEnd, isOffInt, finalRating, id).run();
        } else {
          const newId = id || 'b_' + Date.now();
          await env.DB.prepare(
            'INSERT INTO barbers (id, name, title, avatar, workDays, workStart, workEnd, isOff, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(newId, name, title, avatar, workDaysStr, workStart, workEnd, isOffInt, finalRating).run();
        }

        const { results } = await env.DB.prepare('SELECT * FROM barbers').all();
        const formatted = results.map(b => ({
          ...b,
          workDays: b.workDays ? JSON.parse(b.workDays) : [],
          isOff: b.isOff === 1,
          rating: Number(b.rating)
        }));
        // Broadcast barber update to all connected clients
        await broadcastEvent(env, 'BARBERS_UPDATED', formatted);
        return new Response(JSON.stringify(formatted), { headers });
      }

      if (request.method === 'DELETE') {
        const barberId = url.searchParams.get('id');
        if (!barberId) {
          return new Response(JSON.stringify({ error: 'Missing barber id' }), { status: 400, headers });
        }
        await env.DB.prepare('DELETE FROM barbers WHERE id = ?').bind(barberId).run();
        const { results } = await env.DB.prepare('SELECT * FROM barbers').all();
        const formatted = results.map(b => ({
          ...b,
          workDays: b.workDays ? JSON.parse(b.workDays) : [],
          isOff: b.isOff === 1,
          rating: Number(b.rating)
        }));
        // Broadcast barber deletion to all connected clients
        await broadcastEvent(env, 'BARBERS_UPDATED', formatted);
        return new Response(JSON.stringify(formatted), { headers });
      }
    }

    // ---------------- ROUTE: SERVICES ----------------
    if (path === '/services') {
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM services').all();
        return new Response(JSON.stringify(results), { headers });
      }

      if (request.method === 'POST') {
        const { id, name, price, duration, category, description } = body;

        const existing = await env.DB.prepare('SELECT id FROM services WHERE id = ?').bind(id).first();

        if (existing) {
          await env.DB.prepare(
            'UPDATE services SET name = ?, price = ?, duration = ?, category = ?, description = ? WHERE id = ?'
          ).bind(name, Number(price), Number(duration), category, description, id).run();
        } else {
          const newId = id || 's_' + Date.now();
          await env.DB.prepare(
            'INSERT INTO services (id, name, price, duration, category, description) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(newId, name, Number(price), Number(duration), category, description).run();
        }

        const { results } = await env.DB.prepare('SELECT * FROM services').all();
        // Broadcast service update to all connected clients
        await broadcastEvent(env, 'SERVICES_UPDATED', results);
        return new Response(JSON.stringify(results), { headers });
      }

      if (request.method === 'DELETE') {
        const serviceId = url.searchParams.get('id');
        if (!serviceId) {
          return new Response(JSON.stringify({ error: 'Missing service id' }), { status: 400, headers });
        }
        await env.DB.prepare('DELETE FROM services WHERE id = ?').bind(serviceId).run();
        const { results } = await env.DB.prepare('SELECT * FROM services').all();
        // Broadcast service deletion to all connected clients
        await broadcastEvent(env, 'SERVICES_UPDATED', results);
        return new Response(JSON.stringify(results), { headers });
      }
    }

    // ---------------- ROUTE: BOOKINGS ----------------
    if (path === '/bookings') {
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM bookings ORDER BY createdAt DESC').all();
        const formatted = results.map(b => ({
          ...b,
          serviceIds: b.serviceIds ? JSON.parse(b.serviceIds) : []
        }));
        return new Response(JSON.stringify(formatted), { headers });
      }

      if (request.method === 'POST') {
        const {
          id, customerName, customerPhone, barberId, serviceIds,
          totalPrice, totalDuration, date, time, status, createdAt, notes
        } = body;

        const newId = id || 'bk-' + Math.floor(100000 + Math.random() * 900000);
        const finalStatus = status || 'Pending';
        const finalCreatedAt = createdAt || new Date().toISOString();
        const serviceIdsStr = JSON.stringify(serviceIds || []);

        await env.DB.prepare(
          'INSERT INTO bookings (id, customerName, customerPhone, barberId, serviceIds, totalPrice, totalDuration, date, time, status, createdAt, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          newId, customerName, customerPhone, barberId, serviceIdsStr,
          Number(totalPrice), Number(totalDuration), date, time, finalStatus, finalCreatedAt, notes || ''
        ).run();

        const created = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(newId).first();
        if (created) {
          created.serviceIds = JSON.parse(created.serviceIds);
        }
        // Broadcast new booking to all connected clients
        await broadcastEvent(env, 'NEW_BOOKING', created);
        return new Response(JSON.stringify(created), { headers });
      }

      if (request.method === 'PUT') {
        const { id, status, date, time } = body;
        if (!id) {
          return new Response(JSON.stringify({ error: 'Missing booking id' }), { status: 400, headers });
        }

        if (status && date && time) {
          // Reschedule + status update
          await env.DB.prepare(
            'UPDATE bookings SET status = ?, date = ?, time = ? WHERE id = ?'
          ).bind(status, date, time, id).run();
        } else if (status) {
          // Simple status update
          await env.DB.prepare(
            'UPDATE bookings SET status = ? WHERE id = ?'
          ).bind(status, id).run();
        } else if (date && time) {
          // Simple reschedule
          await env.DB.prepare(
            'UPDATE bookings SET date = ?, time = ?, status = "Rescheduled" WHERE id = ?'
          ).bind(date, time, id).run();
        }

        const { results } = await env.DB.prepare('SELECT * FROM bookings ORDER BY createdAt DESC').all();
        const formatted = results.map(b => ({
          ...b,
          serviceIds: b.serviceIds ? JSON.parse(b.serviceIds) : []
        }));
        // Find the updated booking and broadcast the targeted event
        const updatedBooking = formatted.find(b => b.id === body.id);
        if (updatedBooking) {
          if (body.status && !body.date) {
            // Pure status change
            await broadcastEvent(env, 'BOOKING_STATUS_CHANGED', { id: body.id, status: body.status, booking: updatedBooking });
          } else {
            // Reschedule (with or without status)
            await broadcastEvent(env, 'BOOKING_RESCHEDULED', updatedBooking);
          }
        }
        return new Response(JSON.stringify(formatted), { headers });
      }
    }

    // ---------------- ROUTE: NOTIFICATIONS ----------------
    if (path === '/notifications') {
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM notifications ORDER BY timestamp DESC LIMIT 50').all();
        const formatted = results.map(n => ({
          ...n,
          read: n.read === 1
        }));
        return new Response(JSON.stringify(formatted), { headers });
      }

      if (request.method === 'POST') {
        const { id, title, message, timestamp, type, read, bookingId } = body;
        const newId = id || 'n-' + Date.now();
        const finalTime = timestamp || new Date().toISOString();
        const readVal = read ? 1 : 0;

        await env.DB.prepare(
          'INSERT INTO notifications (id, title, message, timestamp, type, read, bookingId) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(newId, title, message, finalTime, type, readVal, bookingId || null).run();

        const { results } = await env.DB.prepare('SELECT * FROM notifications ORDER BY timestamp DESC LIMIT 50').all();
        const formatted = results.map(n => ({
          ...n,
          read: n.read === 1
        }));
        // Broadcast the newest notification to all connected clients
        const newest = formatted[0];
        if (newest) {
          await broadcastEvent(env, 'NOTIFICATION_ADDED', newest);
        }
        return new Response(JSON.stringify(formatted), { headers });
      }
    }

    // ---------------- ROUTE: NOTIFICATIONS MARK READ ----------------
    if (path === '/notifications/read' && request.method === 'POST') {
      const { id } = body;
      if (id) {
        await env.DB.prepare('UPDATE notifications SET read = 1 WHERE id = ?').bind(id).run();
      } else {
        await env.DB.prepare('UPDATE notifications SET read = 1').run();
      }
      const { results } = await env.DB.prepare('SELECT * FROM notifications ORDER BY timestamp DESC LIMIT 50').all();
      const formatted = results.map(n => ({
        ...n,
        read: n.read === 1
      }));
      return new Response(JSON.stringify(formatted), { headers });
    }

    // ---------------- ROUTE: ADMIN AUTH ----------------
    if (path === '/admin/login' && request.method === 'POST') {
      const { password } = body;
      const stored = await env.DB.prepare('SELECT value FROM settings WHERE key = "admin_password"').first();
      const storedVal = stored ? stored.value : 'admin123';
      const success = password === storedVal;
      return new Response(JSON.stringify({ success }), { headers });
    }

    if (path === '/admin/change-password' && request.method === 'POST') {
      const { password } = body;
      if (!password) {
        return new Response(JSON.stringify({ error: 'Password required' }), { status: 400, headers });
      }
      await env.DB.prepare('UPDATE settings SET value = ? WHERE key = "admin_password"').bind(password).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Health check / Default fallback
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'Barbershop Booking Edge API',
      timestamp: new Date().toISOString(),
      path
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      success: false
    }), { status: 500, headers });
  }
}

