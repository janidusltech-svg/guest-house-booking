"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Room = {
  id: number;
  room_name: string;
  bed_details: string;
  max_persons: number;
  off_season_price: number;
  season_price: number;
};

type BookingInfo = {
  id: number;
  guest_name: string;
  phone_number: string;
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  discount: number;
  final_amount: number;
  notes: string | null;
};

type BookingRoomRow = {
  room_id: number;
  booking_id: number;
  bookings: BookingInfo | null;
};

type SearchBookingResult = {
  booking: BookingInfo;
  roomNames: string[];
};

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function isRoomBookedOnDate(
  checkInDate: string,
  checkOutDate: string,
  selectedDate: string
) {
  const checkIn = dateOnly(checkInDate);
  const checkOut = dateOnly(checkOutDate);
  const selected = dateOnly(selectedDate);

  return selected >= checkIn && selected < checkOut;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [bookedRoomMap, setBookedRoomMap] = useState<Record<number, BookingRoomRow>>({});
  const [allBookingRows, setAllBookingRows] = useState<BookingRoomRow[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingInfo | null>(null);
  const [selectedRoomName, setSelectedRoomName] = useState("");
  const [selectedBookingRoomNames, setSelectedBookingRoomNames] = useState<string[]>([]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editGuestName, setEditGuestName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editCheckInDate, setEditCheckInDate] = useState("");
  const [editCheckOutDate, setEditCheckOutDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [finderText, setFinderText] = useState("");
  const [isFinderOpen, setIsFinderOpen] = useState(false);

  const [showActionPasswordBox, setShowActionPasswordBox] = useState(false);
  const [actionPassword, setActionPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<"edit" | "delete" | null>(null);
  const [pendingBookingForAction, setPendingBookingForAction] =
    useState<BookingInfo | null>(null);

  useEffect(() => {
    fetchRooms();
    fetchAllBookings();
  }, []);

  useEffect(() => {
    fetchBookingsForDate(selectedDate);
  }, [selectedDate]);

  async function fetchRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      alert("Rooms load error: " + error.message);
      return;
    }

    setRooms((data || []) as Room[]);
  }

  async function fetchAllBookings() {
    const { data, error } = await supabase.from("booking_rooms").select(`
        room_id,
        booking_id,
        bookings (
          id,
          guest_name,
          phone_number,
          check_in_date,
          check_out_date,
          total_amount,
          discount,
          final_amount,
          notes
        )
      `);

    if (error) {
      alert("Bookings load error: " + error.message);
      return;
    }

    const normalizedRows: BookingRoomRow[] = ((data || []) as any[]).map((item) => ({
      room_id: item.room_id,
      booking_id: item.booking_id,
      bookings: Array.isArray(item.bookings)
        ? item.bookings[0] ?? null
        : item.bookings ?? null,
    }));

    setAllBookingRows(normalizedRows);
  }

  async function fetchBookingsForDate(date: string) {
    const { data, error } = await supabase.from("booking_rooms").select(`
        room_id,
        booking_id,
        bookings (
          id,
          guest_name,
          phone_number,
          check_in_date,
          check_out_date,
          total_amount,
          discount,
          final_amount,
          notes
        )
      `);

    if (error) {
      alert("Bookings load error: " + error.message);
      return;
    }

    const normalizedRows: BookingRoomRow[] = ((data || []) as any[]).map((item) => ({
      room_id: item.room_id,
      booking_id: item.booking_id,
      bookings: Array.isArray(item.bookings)
        ? item.bookings[0] ?? null
        : item.bookings ?? null,
    }));

    const filteredRows = normalizedRows.filter((item) => {
      if (!item.bookings) return false;

      return isRoomBookedOnDate(
        item.bookings.check_in_date,
        item.bookings.check_out_date,
        date
      );
    });

    const roomMap: Record<number, BookingRoomRow> = {};
    filteredRows.forEach((item) => {
      roomMap[item.room_id] = item;
    });

    setBookedRoomMap(roomMap);
  }

  function getRoomNameById(roomId: number) {
    const room = rooms.find((item) => item.id === roomId);
    return room ? room.room_name : `Room ID ${roomId}`;
  }

  function openBookingDetails(roomName: string, bookingRow: BookingRoomRow | undefined) {
    if (!bookingRow || !bookingRow.bookings) return;

    const allRoomNamesForThisBooking = allBookingRows
      .filter((item) => item.booking_id === bookingRow.booking_id)
      .map((item) => getRoomNameById(item.room_id));

    setSelectedRoomName(roomName);
    setSelectedBooking(bookingRow.bookings);
    setSelectedBookingRoomNames(allRoomNamesForThisBooking);
  }

  function openBookingDetailsFromFinder(booking: BookingInfo) {
    const roomNames = allBookingRows
      .filter((item) => item.booking_id === booking.id)
      .map((item) => getRoomNameById(item.room_id));

    setSelectedRoomName(roomNames[0] || "");
    setSelectedBooking(booking);
    setSelectedBookingRoomNames(roomNames);
    setIsFinderOpen(false);
  }

  function closeBookingDetails() {
    setSelectedBooking(null);
    setSelectedRoomName("");
    setSelectedBookingRoomNames([]);
  }

  function openEditBooking() {
    if (!selectedBooking) return;

    setEditGuestName(selectedBooking.guest_name);
    setEditPhoneNumber(selectedBooking.phone_number);
    setEditCheckInDate(selectedBooking.check_in_date);
    setEditCheckOutDate(selectedBooking.check_out_date);
    setEditNotes(selectedBooking.notes || "");
    setIsEditOpen(true);
  }

  function closeEditBooking() {
    setIsEditOpen(false);
  }

  function askPasswordForAction(action: "edit" | "delete", booking: BookingInfo) {
    setPendingAction(action);
    setPendingBookingForAction(booking);
    setActionPassword("");
    setShowActionPasswordBox(true);
  }

  function closeActionPasswordBox() {
    setShowActionPasswordBox(false);
    setActionPassword("");
    setPendingAction(null);
    setPendingBookingForAction(null);
  }

  async function confirmActionPassword() {
    if (actionPassword !== "janidu") {
      alert("Wrong password");
      return;
    }

    if (!pendingAction || !pendingBookingForAction) {
      closeActionPasswordBox();
      return;
    }

    if (pendingAction === "edit") {
      setSelectedBooking(pendingBookingForAction);
      setEditGuestName(pendingBookingForAction.guest_name);
      setEditPhoneNumber(pendingBookingForAction.phone_number);
      setEditCheckInDate(pendingBookingForAction.check_in_date);
      setEditCheckOutDate(pendingBookingForAction.check_out_date);
      setEditNotes(pendingBookingForAction.notes || "");
      setIsEditOpen(true);
      closeActionPasswordBox();
      return;
    }

    if (pendingAction === "delete") {
      closeActionPasswordBox();
      await handleDeleteBooking(pendingBookingForAction.id);
    }
  }

  async function handleSaveEdit() {
    if (!selectedBooking) return;

    if (!editGuestName.trim()) {
      alert("Please enter guest name.");
      return;
    }

    if (!editPhoneNumber.trim()) {
      alert("Please enter phone number.");
      return;
    }

    if (!editCheckInDate || !editCheckOutDate) {
      alert("Please select check-in and check-out dates.");
      return;
    }

    if (editCheckOutDate <= editCheckInDate) {
      alert("Check-out date must be after check-in date.");
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({
        guest_name: editGuestName,
        phone_number: editPhoneNumber,
        check_in_date: editCheckInDate,
        check_out_date: editCheckOutDate,
        notes: editNotes,
      })
      .eq("id", selectedBooking.id);

    if (error) {
      alert("Update error: " + error.message);
      return;
    }

    alert("Booking updated successfully.");
    setIsEditOpen(false);
    closeBookingDetails();
    fetchBookingsForDate(selectedDate);
    fetchAllBookings();
  }

  async function handleDeleteBooking(bookingId: number) {
    const confirmed = window.confirm("Are you sure you want to delete this booking?");
    if (!confirmed) return;

    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);

    if (error) {
      alert("Delete error: " + error.message);
      return;
    }

    alert("Booking deleted successfully.");
    closeBookingDetails();
    fetchBookingsForDate(selectedDate);
    fetchAllBookings();
  }

  const finderResults = useMemo(() => {
    const text = finderText.trim().toLowerCase();
    if (!text) return [];

    const bookingMap = new Map<number, SearchBookingResult>();

    allBookingRows.forEach((item) => {
      if (!item.bookings) return;

      const guestName = item.bookings.guest_name.toLowerCase();
      const phone = item.bookings.phone_number.toLowerCase();

      if (guestName.includes(text) || phone.includes(text)) {
        if (!bookingMap.has(item.booking_id)) {
          bookingMap.set(item.booking_id, {
            booking: item.bookings,
            roomNames: [],
          });
        }

        const entry = bookingMap.get(item.booking_id)!;
        const roomName = getRoomNameById(item.room_id);

        if (!entry.roomNames.includes(roomName)) {
          entry.roomNames.push(roomName);
        }
      }
    });

    return Array.from(bookingMap.values());
  }, [finderText, allBookingRows, rooms]);

  const totalRooms = rooms.length;
  const bookedCount = Object.keys(bookedRoomMap).length;
  const availableCount = totalRooms - bookedCount;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-md px-3 py-4">
        <div className="rounded-3xl bg-slate-900 px-5 py-6 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
            Guest House
          </p>
          <h1 className="mt-2 text-3xl font-bold">JANIDU GUEST</h1>
          <p className="mt-1 text-sm text-slate-300">Kataragama</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              href="/add-booking"
              className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900"
            >
              Add Booking
            </a>
            <button
              type="button"
              onClick={() => setIsFinderOpen(true)}
              className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
            >
              Finder
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-400">Rooms</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{totalRooms}</p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-emerald-700">Free</p>
            <p className="mt-2 text-2xl font-bold text-emerald-900">{availableCount}</p>
          </div>

          <div className="rounded-2xl bg-rose-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-rose-700">Booked</p>
            <p className="mt-2 text-2xl font-bold text-rose-900">{bookedCount}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Search Booking</p>
          <input
            type="text"
            value={finderText}
            onChange={(e) => setFinderText(e.target.value)}
            placeholder="Guest name or mobile number"
            className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
          />
          <button
            type="button"
            onClick={() => setIsFinderOpen(true)}
            className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-white"
          >
            Find Booking
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Selected Date</p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-slate-900"
          />
          <p className="mt-2 text-sm text-slate-500">{formatDate(selectedDate)}</p>
        </div>

        <div className="mt-5">
          <div className="mb-3">
            <h2 className="text-xl font-bold text-slate-900">Room Status</h2>
            <p className="text-sm text-slate-500">Tap a booked room for details</p>
          </div>

          <div className="space-y-3">
            {rooms.map((room) => {
              const bookedRow = bookedRoomMap[room.id];
              const isBooked = !!bookedRow;

              return (
                <div
                  key={room.id}
                  onClick={() =>
                    isBooked ? openBookingDetails(room.room_name, bookedRow) : undefined
                  }
                  className={`rounded-3xl p-4 shadow-sm ${
                    isBooked
                      ? "bg-rose-50 ring-1 ring-rose-200"
                      : "bg-emerald-50 ring-1 ring-emerald-200"
                  } ${isBooked ? "cursor-pointer" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {room.room_name}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          isBooked
                            ? "bg-rose-600 text-white"
                            : "bg-emerald-600 text-white"
                        }`}
                      >
                        {isBooked ? "BOOKED" : "FREE"}
                      </span>
                    </div>

                    {isBooked && bookedRow.bookings && (
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        Guest: {bookedRow.bookings.guest_name}
                      </p>
                    )}

                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>Beds: {room.bed_details}</p>
                      <p>Max persons: {room.max_persons}</p>
                      <p>Off season: Rs. {room.off_season_price}</p>
                      <p>Season: Rs. {room.season_price}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (bookedRow) {
                          openBookingDetails(room.room_name, bookedRow);
                        }
                      }}
                      className="rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-slate-900"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (bookedRow?.bookings) {
                          openBookingDetails(room.room_name, bookedRow);
                          askPasswordForAction("edit", bookedRow.bookings);
                        }
                      }}
                      className="rounded-2xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (bookedRow?.bookings) {
                          askPasswordForAction("delete", bookedRow.bookings);
                        }
                      }}
                      className="rounded-2xl bg-rose-600 px-3 py-3 text-sm font-semibold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isFinderOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 p-3">
          <div className="mx-auto mt-6 max-w-md rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">Finder Results</h2>
              <button
                type="button"
                onClick={() => setIsFinderOpen(false)}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            {finderText.trim() === "" ? (
              <p className="mt-4 text-sm text-slate-500">
                Type a guest name or mobile number first.
              </p>
            ) : finderResults.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No matching bookings found.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {finderResults.map((result) => (
                  <div
                    key={result.booking.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-lg font-bold text-slate-900">
                      {result.booking.guest_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Mobile: {result.booking.phone_number}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Check-in: {formatDate(result.booking.check_in_date)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Check-out: {formatDate(result.booking.check_out_date)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Rooms: {result.roomNames.join(", ")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      Final: Rs. {result.booking.final_amount}
                    </p>

                    <button
                      type="button"
                      onClick={() => openBookingDetailsFromFinder(result.booking)}
                      className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Open Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedBooking && !isEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 p-3">
          <div className="mx-auto mt-6 max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Booking Details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedRoomName || "Booking"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeBookingDetails}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Guest Name
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {selectedBooking.guest_name}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Phone Number
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {selectedBooking.phone_number}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Check-in
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatDate(selectedBooking.check_in_date)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Check-out
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatDate(selectedBooking.check_out_date)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Booked Rooms
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedBookingRoomNames.map((roomName) => (
                    <span
                      key={roomName}
                      className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700"
                    >
                      {roomName}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Total
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedBooking.total_amount}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Discount
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedBooking.discount}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Final
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedBooking.final_amount}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Notes
                </p>
                <p className="mt-1 text-slate-700">{selectedBooking.notes || "-"}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (selectedBooking) {
                    askPasswordForAction("edit", selectedBooking);
                  }
                }}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Edit Booking
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedBooking) {
                    askPasswordForAction("delete", selectedBooking);
                  }
                }}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedBooking && isEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 p-3">
          <div className="mx-auto mt-6 max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Edit Booking</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedRoomName}</p>
              </div>

              <button
                type="button"
                onClick={closeEditBooking}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Guest Name
                </label>
                <input
                  type="text"
                  value={editGuestName}
                  onChange={(e) => setEditGuestName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Check-in Date
                  </label>
                  <input
                    type="date"
                    value={editCheckInDate}
                    onChange={(e) => setEditCheckInDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Check-out Date
                  </label>
                  <input
                    type="date"
                    value={editCheckOutDate}
                    onChange={(e) => setEditCheckOutDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Save
              </button>

              <button
                type="button"
                onClick={closeEditBooking}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showActionPasswordBox && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 p-3">
          <div className="mx-auto mt-6 max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Enter Password</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Password needed for {pendingAction === "edit" ? "edit" : "delete"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeActionPasswordBox}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <input
              type="password"
              value={actionPassword}
              onChange={(e) => setActionPassword(e.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
              placeholder="Enter password"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={confirmActionPassword}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-white"
              >
                Confirm
              </button>

              <button
                type="button"
                onClick={closeActionPasswordBox}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-base font-semibold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
