"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type RoomDetail = {
  id: number;
  room_name: string;
  bed_details: string;
  max_persons: number;
  off_season_price: number;
  season_price: number;
};

type PriceChoice = {
  mode: "off" | "season" | "manual";
  manualPrice: string;
};

type BookingRow = {
  room_id: number;
  bookings: {
    check_in_date: string;
    check_out_date: string;
  } | null;
};

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function rangesOverlap(
  newCheckIn: string,
  newCheckOut: string,
  existingCheckIn: string,
  existingCheckOut: string
) {
  const newIn = dateOnly(newCheckIn);
  const newOut = dateOnly(newCheckOut);
  const existingIn = dateOnly(existingCheckIn);
  const existingOut = dateOnly(existingCheckOut);

  return newIn < existingOut && newOut > existingIn;
}

export default function AddBookingPage() {
  const [guestName, setGuestName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("");
  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [password, setPassword] = useState("");

  const [roomPrices, setRoomPrices] = useState<Record<string, PriceChoice>>({});
  const [pricingRoom, setPricingRoom] = useState<string | null>(null);
  const [tempMode, setTempMode] = useState<"off" | "season" | "manual">("off");
  const [tempManualPrice, setTempManualPrice] = useState("");

  const [roomDetails, setRoomDetails] = useState<RoomDetail[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const [bookingRows, setBookingRows] = useState<BookingRow[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [checkInDate, checkOutDate]);

  async function fetchRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      alert("Supabase error: " + error.message);
      console.error("SUPABASE FETCH ROOMS ERROR:", error);
    } else {
      setRoomDetails(data || []);
    }

    setLoadingRooms(false);
  }

  async function fetchBookings() {
    if (!checkInDate || !checkOutDate) {
      setBookingRows([]);
      return;
    }

    setLoadingAvailability(true);

    const { data, error } = await supabase
      .from("booking_rooms")
      .select(
        `
        room_id,
        bookings (
          check_in_date,
          check_out_date
        )
      `
      );

    if (error) {
      alert("Availability load error: " + error.message);
      console.error("SUPABASE FETCH BOOKINGS ERROR:", error);
      setBookingRows([]);
    } else {
      setBookingRows((data || []) as BookingRow[]);
    }

    setLoadingAvailability(false);
  }

  function getRoomByName(roomName: string) {
    return roomDetails.find((room) => room.room_name === roomName);
  }

function getRoomAvailability(roomName: string) {
  if (!checkInDate || !checkOutDate) {
    return null;
  }

  const room = getRoomByName(roomName);
  if (!room) return null;

  const hasConflict = bookingRows.some((item) => {
    if (item.room_id !== room.id) return false;
    if (!item.bookings) return false;

    const booking = Array.isArray(item.bookings)
      ? item.bookings[0]
      : item.bookings;

    if (!booking) return false;

    return rangesOverlap(
      checkInDate,
      checkOutDate,
      booking.check_in_date,
      booking.check_out_date
    );
  });

  return !hasConflict;
}

  function getRoomFinalPrice(roomName: string) {
    const room = getRoomByName(roomName);
    const priceChoice = roomPrices[roomName];

    if (!room || !priceChoice) return 0;

    if (priceChoice.mode === "off") return Number(room.off_season_price);
    if (priceChoice.mode === "season") return Number(room.season_price);

    const manual = Number(priceChoice.manualPrice);
    return Number.isNaN(manual) ? 0 : manual;
  }

  const totalAmount = useMemo(() => {
    return selectedRooms.reduce(
      (sum, roomName) => sum + getRoomFinalPrice(roomName),
      0
    );
  }, [selectedRooms, roomPrices, roomDetails]);

  const discountAmount = Number(discount) || 0;
  const finalAmount = Math.max(totalAmount - discountAmount, 0);

  function openPricePopup(roomName: string) {
    const existing = roomPrices[roomName];
    setPricingRoom(roomName);
    setTempMode(existing?.mode ?? "off");
    setTempManualPrice(existing?.manualPrice ?? "");
  }

  function handleRoomChange(roomName: string) {
    const isSelected = selectedRooms.includes(roomName);

    if (isSelected) {
      setSelectedRooms((prev) => prev.filter((r) => r !== roomName));
      setRoomPrices((prev) => {
        const updated = { ...prev };
        delete updated[roomName];
        return updated;
      });
      return;
    }

    const availability = getRoomAvailability(roomName);
    if (availability === false) {
      alert(`${roomName} is not available for selected dates.`);
      return;
    }

    setSelectedRooms((prev) => [...prev, roomName]);
    openPricePopup(roomName);
  }

  function saveRoomPrice() {
    if (!pricingRoom) return;

    if (tempMode === "manual") {
      if (tempManualPrice.trim() === "") {
        alert("Please enter manual price.");
        return;
      }

      if (Number(tempManualPrice) < 0) {
        alert("Manual price cannot be negative.");
        return;
      }
    }

    setRoomPrices((prev) => ({
      ...prev,
      [pricingRoom]: {
        mode: tempMode,
        manualPrice: tempManualPrice,
      },
    }));

    setPricingRoom(null);
    setTempMode("off");
    setTempManualPrice("");
  }

  function closePricePopup() {
    if (pricingRoom && !roomPrices[pricingRoom]) {
      setSelectedRooms((prev) => prev.filter((r) => r !== pricingRoom));
    }

    setPricingRoom(null);
    setTempMode("off");
    setTempManualPrice("");
  }

  function handleEditRoomPrice(roomName: string) {
    openPricePopup(roomName);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!guestName.trim()) {
      alert("Please enter guest name.");
      return;
    }

    if (!phoneNumber.trim()) {
      alert("Please enter phone number.");
      return;
    }

    if (!checkInDate || !checkOutDate) {
      alert("Please select check-in and check-out dates.");
      return;
    }

    if (checkOutDate <= checkInDate) {
      alert("Check-out date must be after check-in date.");
      return;
    }

    if (selectedRooms.length === 0) {
      alert("Please select at least one room.");
      return;
    }

    const hasUnavailableRoom = selectedRooms.some(
      (roomName) => getRoomAvailability(roomName) === false
    );

    if (hasUnavailableRoom) {
      alert("One or more selected rooms are not available.");
      return;
    }

    const missingPrices = selectedRooms.some((roomName) => !roomPrices[roomName]);

    if (missingPrices) {
      alert("Please set price for every selected room.");
      return;
    }

    setShowPasswordBox(true);
  }

  async function handlePasswordConfirm() {
    if (password !== "janidu") {
      alert("Wrong password");
      return;
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .insert([
        {
          guest_name: guestName,
          phone_number: phoneNumber,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          total_amount: totalAmount,
          discount: discountAmount,
          final_amount: finalAmount,
          notes,
        },
      ])
      .select()
      .single();

    if (bookingError) {
      alert("Booking save error: " + bookingError.message);
      return;
    }

    const selectedRoomRecords = selectedRooms.map((roomName) => {
      const room = getRoomByName(roomName);
      const priceChoice = roomPrices[roomName];

      return {
        booking_id: bookingData.id,
        room_id: room?.id,
        price_type: priceChoice.mode,
        manual_price:
          priceChoice.mode === "manual" ? Number(priceChoice.manualPrice) : null,
        final_room_price: getRoomFinalPrice(roomName),
      };
    });

    const { error: bookingRoomsError } = await supabase
      .from("booking_rooms")
      .insert(selectedRoomRecords);

    if (bookingRoomsError) {
      alert("Room save error: " + bookingRoomsError.message);
      return;
    }

    alert("Booking saved successfully.");

    setGuestName("");
    setPhoneNumber("");
    setSelectedRooms([]);
    setCheckInDate("");
    setCheckOutDate("");
    setNotes("");
    setDiscount("");
    setRoomPrices({});
    setShowPasswordBox(false);
    setPassword("");
    setBookingRows([]);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-md px-3 py-4">
        <div className="rounded-3xl bg-slate-900 px-5 py-6 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
                Booking Page
              </p>
              <h1 className="mt-2 text-3xl font-bold">Add Booking</h1>
              <p className="mt-1 text-sm text-slate-300">
                JANIDU GUEST - Kataragama
              </p>
            </div>

            <a
              href="/"
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
            >
              Home
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              Guest Details
            </p>

            <div className="space-y-3">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
                placeholder="Guest name"
              />

              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
                placeholder="Phone number"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              Stay Dates
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  Check-in Date
                </label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">
                  Check-out Date
                </label>
                <input
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-slate-900"
                />
              </div>

              {loadingAvailability && checkInDate && checkOutDate && (
                <p className="text-sm font-medium text-slate-500">
                  Checking room availability...
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Select Rooms</p>
              <p className="text-xs text-slate-400">Tap room to set price</p>
            </div>

            {loadingRooms ? (
              <div className="rounded-2xl border border-slate-300 p-4 text-sm text-slate-500">
                Loading rooms...
              </div>
            ) : (
              <div className="space-y-3">
                {roomDetails.map((room) => {
                  const availability = getRoomAvailability(room.room_name);
                  const isSelected = selectedRooms.includes(room.room_name);
                  const selectedPrice = getRoomFinalPrice(room.room_name);
                  const selectedMode = roomPrices[room.room_name]?.mode;

                  return (
                    <div
                      key={room.id}
                      className={`rounded-3xl p-4 ring-1 ${
                        isSelected
                          ? "bg-slate-900 text-white ring-slate-900"
                          : availability === false
                          ? "bg-rose-50 text-slate-900 ring-rose-200"
                          : "bg-slate-50 text-slate-900 ring-slate-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRoomChange(room.room_name)}
                          className="mt-1 h-5 w-5"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-bold">{room.room_name}</h3>
                            {isSelected && (
                              <button
                                type="button"
                                onClick={() => handleEditRoomPrice(room.room_name)}
                                className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                              >
                                Set Price
                              </button>
                            )}
                          </div>

                          <div
                            className={`mt-3 space-y-1 text-sm ${
                              isSelected ? "text-slate-200" : "text-slate-600"
                            }`}
                          >
                            <p>Beds: {room.bed_details}</p>
                            <p>Max persons: {room.max_persons}</p>
                            <p>Off season: Rs. {room.off_season_price}</p>
                            <p>Season: Rs. {room.season_price}</p>
                          </div>

                          {checkInDate && checkOutDate && (
                            <p
                              className={`mt-3 text-sm font-semibold ${
                                availability === false
                                  ? "text-rose-500"
                                  : isSelected
                                  ? "text-emerald-300"
                                  : "text-emerald-600"
                              }`}
                            >
                              {availability === false ? "Not available" : "Available"}
                            </p>
                          )}

                          {isSelected && roomPrices[room.room_name] && (
                            <div className="mt-3 rounded-2xl bg-white/10 p-3 text-sm">
                              <p>
                                Price Type:{" "}
                                {selectedMode === "off"
                                  ? "Off Season"
                                  : selectedMode === "season"
                                  ? "Season"
                                  : "Manual"}
                              </p>
                              <p className="mt-1 font-semibold">
                                Room Price: Rs. {selectedPrice}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              Amount Summary
            </p>

            <div className="space-y-2">
              {selectedRooms.length === 0 && (
                <p className="text-sm text-slate-500">No rooms selected yet.</p>
              )}

              {selectedRooms.map((roomName) => (
                <div
                  key={roomName}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-slate-700">{roomName}</span>
                  <span className="font-semibold text-slate-900">
                    Rs. {getRoomFinalPrice(roomName)}
                  </span>
                </div>
              ))}

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total Amount</span>
                  <span className="font-semibold text-slate-900">
                    Rs. {totalAmount}
                  </span>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-600">
                    Discount
                  </label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
                    placeholder="Enter discount if needed"
                  />
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-4 text-white">
                  <span className="text-base font-semibold">Final Amount</span>
                  <span className="text-lg font-bold">Rs. {finalAmount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-slate-700">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
              placeholder="Any notes"
              rows={4}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-base font-semibold text-white shadow-sm"
          >
            Save Booking
          </button>
        </form>

        {pricingRoom && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 p-3">
            <div className="mx-auto mt-8 max-w-md rounded-3xl bg-white p-5 shadow-2xl">
              <h2 className="text-2xl font-bold text-slate-900">
                {pricingRoom} Price
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose price type for this room
              </p>

              {(() => {
                const room = getRoomByName(pricingRoom);
                if (!room) return null;

                return (
                  <div className="mt-5 space-y-3">
                    <button
                      type="button"
                      onClick={() => setTempMode("off")}
                      className={`w-full rounded-2xl border px-4 py-4 text-left text-base ${
                        tempMode === "off"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
                    >
                      Off Season Price: Rs. {room.off_season_price}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTempMode("season")}
                      className={`w-full rounded-2xl border px-4 py-4 text-left text-base ${
                        tempMode === "season"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
                    >
                      Season Price: Rs. {room.season_price}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTempMode("manual")}
                      className={`w-full rounded-2xl border px-4 py-4 text-left text-base ${
                        tempMode === "manual"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
                    >
                      Manual Price
                    </button>

                    {tempMode === "manual" && (
                      <input
                        type="number"
                        value={tempManualPrice}
                        onChange={(e) => setTempManualPrice(e.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
                        placeholder="Enter manual price"
                      />
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={saveRoomPrice}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-white"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={closePricePopup}
                        className="rounded-2xl bg-slate-100 px-4 py-3 text-base font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {showPasswordBox && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 p-3">
            <div className="mx-auto mt-8 max-w-md rounded-3xl bg-white p-5 shadow-2xl">
              <h2 className="text-2xl font-bold text-slate-900">
                Enter Password
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Type password to save booking
              </p>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900"
                placeholder="Enter password"
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handlePasswordConfirm}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-base font-semibold text-white"
                >
                  Confirm
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordBox(false);
                    setPassword("");
                  }}
                  className="rounded-2xl bg-slate-100 px-4 py-3 text-base font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}