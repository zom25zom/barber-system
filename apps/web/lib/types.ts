export type Customer = {
  id: number;
  username: string;
  phone: string;
};

export type Service = {
  id: number;
  barber_id: number;
  name: string;
  price: number;
  duration_minutes: number;
};

export type Barber = {
  id: number;
  name: string;
  photo_url: string | null;
  services: Service[];
};

export type OwnerBarber = {
  id: number;
  name: string;
  photo_url: string | null;
  is_active: number;
};

export type Slot = {
  start_time: string;
  end_time: string;
};

export type BookingService = {
  name: string;
  price: number;
  duration_minutes: number;
};

export type Booking = {
  id: number;
  barber_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  barber_name: string;
  customer_name?: string;
  customer_phone?: string;
  services: BookingService[];
  created_at?: string;
};

export type WaitlistEntry = {
  id: number;
  barber_id: number;
  barber_name: string;
  desired_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

export type AppNotification = {
  id: number;
  type: string;
  message: string;
  is_read: number;
  booking_id?: number | null;
  created_at: string;
};

export type ScheduleDay = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_day_off: boolean;
};

export type BarberTimeOff = {
  id: number;
  barber_id: number;
  date: string;
  reason: string | null;
  created_at?: string;
};

export type BarberBreak = {
  id: number;
  barber_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at?: string;
};

export type OwnerStats = {
  daily: { date: string; count: number }[];
  week: { expected_revenue: number; bookings: number };
  top_services: { name: string; count: number; revenue: number }[];
  no_shows: { customer_name: string; barber_name: string; count: number }[];
  totals: { status: string; count: number }[];
};
