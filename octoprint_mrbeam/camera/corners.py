#!/usr/bin/env python3

# from typing import Mapping
import yaml

from .definitions import UNDIST_CALIB_MARKERS_KEY, UNDIST_CORNERS_KEY, FACT_RAW_CORNERS_KEY, CALIB_REFS, QD_KEYS, MAX_OBJ_HEIGHT, CAMERA_HEIGHT
import logging
from os.path import isfile
import os
from octoprint_mrbeam.util import dict_map
import numpy as np
from numpy.linalg import norm
import cv2

# Set this after merging the logging overhaul.
_logger = logging.getLogger(__name__)

#@logtime()
def warpImgByCorners(image, corners, zoomed_out=False):
	"""
	Warps the region delimited by the corners in order to straighten it.
	:param image: takes an opencv image
	:param corners: as qd-dict
	:param zoomed_out: wether to zoom out the pic to account for object height
	:return: image with corners warped
	"""

	def f(qd):
		return np.array(corners[qd])

	nw, ne, sw, se = map(f, QD_KEYS)

	# calculate maximum width and height for destination points
	width1 = norm(se - sw)
	width2 = norm(ne - nw)
	maxWidth = max(int(width1), int(width2))

	height1 = norm(ne - se)
	height2 = norm(nw - sw)
	maxHeight = max(int(height1), int(height2))

	if zoomed_out:
		factor = float(MAX_OBJ_HEIGHT) / CAMERA_HEIGHT / 2
		min_dst_x = factor * maxWidth
		max_dst_x = (1+factor) * maxWidth
		min_dst_y = factor * maxHeight
		max_dst_y = (1+factor) * maxHeight
		dst_size = (int((1+2*factor) * maxWidth), int((1+2*factor)*maxHeight))
	else:
		min_dst_x, max_dst_x = 0, maxWidth - 1
		min_dst_y, max_dst_y = 0, maxHeight -1
		dst_size = (maxWidth, maxHeight)

	# source points for matrix calculation
	src = np.array((nw, ne, se, sw), dtype="float32")

	# destination points in the same order
	dst = np.array([[min_dst_x, min_dst_y],  # nw
                    [max_dst_x, min_dst_y],  # ne
                    [max_dst_x, max_dst_y],  # sw
                    [min_dst_x, max_dst_y]], # se
                   dtype="float32")

	# get the perspective transform matrix
	transMatrix = cv2.getPerspectiveTransform(src, dst)

	# compute warped image
	warpedImg = cv2.warpPerspective(image, transMatrix, dst_size)
	return warpedImg

def save_corner_calibration(path, newCorners, newMarkers, hostname=None, from_factory=False):
	"""Save the settings onto a calibration file"""

	# transform dict
	for new_ in [newCorners, newMarkers]:
		# assert isinstance(new_, Mapping)
		assert isinstance(new_, dict)
		assert all(qd in new_.keys() for qd in QD_KEYS)
	try:
		with open(path, "r") as f:
			# yaml.safe_load is None if file exists but empty
			pic_settings = yaml.safe_load(f) or {}
	except IOError:
		_logger.debug("Could not find the previous picture settings.")
		pic_settings = {}

	if from_factory:
		from .definitions import FACT_RAW_CORNERS_KEY as __CORNERS_KEY, FACT_RAW_CALIB_MARKERS_KEY as __MARKERS_KEY
	else:
		from .definitions import RAW_CORNERS_KEY as __CORNERS_KEY, RAW_CALIB_MARKERS_KEY as __MARKERS_KEY

	pic_settings[__CORNERS_KEY] = newCorners
	pic_settings[__MARKERS_KEY] = newMarkers
	pic_settings['calibration_updated'] = True # DEPRECATED but Necessary for legacy algo
	if hostname:
		pic_settings['hostname_KEY'] = hostname

	_logger.debug('picSettings new to save: {}'.format(pic_settings))
	with open(path, "wb") as f:
		yaml.safe_dump(pic_settings, f, indent="  ", allow_unicode=True)
	_logger.info("New corner calibration has been saved")

def get_corner_calibration(path):
	"""Returns the corner calibration written to pic_settings"""
	if not isfile(path) or os.stat(path).st_size == 0:
		return None
	try:
		with open(path) as yaml_file:
			return yaml.safe_load(yaml_file)
	except:
		_logger.info("Exception while loading '%s' > pic_settings file not readable", path)
		return None

def get_deltas(
		settings,
		undistorted=False,
		matrix=None,
		dist=None,
		from_factory=False):
	"""Returns the relative positions (delta) of the markers and corners according to the calibration (in px)
	By default, returns delta for the raw pictures.

	If `undistorted==True` and matrix and dist are given, will return the undistorted coordinates
	calculated from the raw settings.
	Otherwise, try to find the undistorted values written in the calibration file (Legacy mode).
	:param path_to_settings_file: either settings dict or path to pic_settings yaml
	:param undistorted: Get the delta for the undistorted version of the picture.
	:param matrix: lens distortion matrix
	:param dist: from the lens calibration
	:param path_to_last_markers_json: needed for overwriting file if updated
	:return: pic_settings as dict
	"""
	from octoprint_mrbeam.camera.lens import undist_points
	if type(settings) is str:
		pic_settings = get_corner_calibration(settings)
		if pic_settings is None: return None
	else:
		pic_settings = settings
	for k in [UNDIST_CALIB_MARKERS_KEY, UNDIST_CORNERS_KEY]:
		if not (k in pic_settings and _isValidQdDict(pic_settings[k])):
			_pic_settings[k] = None
		elif k in pic_settings.keys() and pic_settings[k] is not None:
			for qd in QD_KEYS:
				pic_settings[k][qd] = np.array(pic_settings[k][qd])

	# Values taken from the calibration file. Used as a reference to warp the image correctly.
	# Legacy devices only have the values for the lensCorrected position.
	# FIXME TODO - Delete the lensCorrected corner calibration every time a lens calibration is made
	# FIXME move current lensCorrected cornerCalibration to the cornerCalibrationFromFactory
	#       (can be safely deleted once the user did 1 corner calibration on a raw picture)
	# warp image
	# TODO
	calibrationReferences = dict_map(lambda key: pic_settings.get(key, None), CALIB_REFS)
	for k in calibrationReferences.keys():
		calibrationReferences[k]['result'] = None

	priorityList = ['user', 'factory'] if not from_factory else ['factory']
	for types, ref in calibrationReferences.items():
		# Find the correct reference position for both the markers and the corners
		if undistorted:
			for k in priorityList:
				# Prioritize converting positions from the raw values we have saved.
				# (It is calibration-agnostic)
				if ref[k]['raw'] is not None and matrix is not None and dist is not None:
					# TODO distort references
					inPts = [ref[k]['raw'][qd] for qd in QD_KEYS]
					res_iter = undist_points(inPts, matrix, dist)
					ref['result'] = {QD_KEYS[i]: np.array(pos) for i, pos in enumerate(res_iter)}
					break # no need to go further in the priority list
				elif ref[k]['undistorted']:
					ref['result'] = dict_map(np.array, ref[k]['undistorted'])
					break # no need to go further in the priority list
		else:
			for k in priorityList:
				# Prioritize converting positions from the raw values we have saved.
				# (It is calibration-agnostic)
				if ref[k]['raw'] is not None:
					ref['result'] = dict_map(np.array, ref[k]['raw'])
					break # no need to go further in the priority list
				elif ref[k]['undistorted'] is not None:
					# TODO reverse distort references
					# Could not find how to undistort,
					# will ask to redo calibration.
					ref['result'] = None
					# break # no need to go further in the priority list
		if ref['result'] is None:
			# No corner calibration done,
			# cannot apply warp perspective
			return None
	refMarkers, refCorners = (calibrationReferences[k]['result'] for k in ['markers', 'corners'])
	delta = {qd: refCorners[qd] - refMarkers[qd] for qd in QD_KEYS}
	return delta

def _isValidQdDict(qdDict):
	"""
	:param: qd-Dict to test for valid Keys
	:returns True or False
	"""
	return type(qdDict) is dict \
		and all(
			qd in qdDict and \
			len(qdDict[qd]) == 2 and \
			all(not x is None for x in qdDict[qd])
			for qd in QD_KEYS
		)
