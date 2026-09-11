"""Tests for the GDAL command runner: progress parsing and cancellation.

These exercise ``_run_gdal_command`` with ordinary shell utilities (``printf``,
``false``, ``sleep``) so they don't require GDAL to be installed.
"""

import subprocess
import tempfile
import threading
import time

import pytest

from jupytergis_core.processing import (
    ProcessingCancelledError,
    _run_gdal_command,
)


def test_progress_meter_is_parsed_to_fractions():
    """A GDAL-style stdout meter is forwarded as fractions in [0, 1]."""
    seen: list[float] = []
    with tempfile.TemporaryDirectory() as tmpdir:
        _run_gdal_command(
            ["printf", "0...10...20...50...100 - done."],
            cwd=tmpdir,
            timeout=5,
            progress_callback=lambda f: seen.append(round(f, 2)),
        )
    assert seen == [0.0, 0.1, 0.2, 0.5, 1.0]


def test_chatter_around_the_meter_is_not_read_as_progress():
    """Only the meter counts — digits in gdalwarp's own messages must not.

    This is real gdalwarp -of GTiff output: it echoes the source path, and the
    /vsicurl URL contains "100" and "2023". A bare digit scan reports 100%
    before a single pixel has been warped.
    """
    seen: list[float] = []
    chatter = (
        "Creating output file that is 10715P x 10313L.\n"
        "Processing /vsicurl/https://example.org/d/FCM-AGB-100m/2023/01/01/"
        "FCM_Europe_demo_2023_AGB.tif [1/1] : "
    )
    with tempfile.TemporaryDirectory() as tmpdir:
        _run_gdal_command(
            ["printf", "%s0...50...100 - done.", chatter],
            cwd=tmpdir,
            timeout=5,
            progress_callback=lambda f: seen.append(round(f, 2)),
        )
    assert seen == [0.0, 0.5, 1.0]


def test_nonzero_exit_raises_called_process_error():
    with (
        tempfile.TemporaryDirectory() as tmpdir,
        pytest.raises(subprocess.CalledProcessError),
    ):
        _run_gdal_command(["false"], cwd=tmpdir, timeout=5)


def test_cancel_event_kills_process_and_raises():
    """Setting the cancel event kills the subprocess and raises promptly."""
    cancel_event = threading.Event()

    # Fire the cancel shortly after the (long) command starts.
    threading.Timer(0.2, cancel_event.set).start()

    start = time.monotonic()
    with (
        tempfile.TemporaryDirectory() as tmpdir,
        pytest.raises(ProcessingCancelledError),
    ):
        _run_gdal_command(
            ["sleep", "30"],
            cwd=tmpdir,
            timeout=30,
            cancel_event=cancel_event,
        )
    elapsed = time.monotonic() - start
    # It must return on cancellation, not wait out the 30s sleep/timeout.
    assert elapsed < 5
