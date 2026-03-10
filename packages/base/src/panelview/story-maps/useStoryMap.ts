import type {
	IJGISLayer,
	IJGISStoryMap,
	IJupyterGISModel,
	IStorySegmentLayer,
} from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

/** Entry for a layer affected by layer override: remove (added clone) or restore (modified existing). */
export interface IOverrideLayerEntry {
	layerId: string;
	action: 'remove' | 'restore';
}

export interface IUseStoryMapParams {
	model: IJupyterGISModel;
	overrideLayerEntriesRef: React.RefObject<IOverrideLayerEntry[]>;
	removeLayer?: (id: string) => void;
}

/**
 * Hook for story-map panel: owns currentIndex and storyData state, derives segments, and exposes navigation and override helpers.
 */
export function useStoryMap({
	model,
	overrideLayerEntriesRef,
	removeLayer,
}: IUseStoryMapParams) {
	const [currentIndex, setCurrentIndex] = useState(
		() => model.getCurrentSegmentIndex() ?? 0,
	);
	const [storyData, setStoryData] = useState<IJGISStoryMap | null>(
		() => model.getSelectedStory().story ?? null,
	);

	useEffect(() => {
		const onIndexChanged = (_: IJupyterGISModel, index: number) => {
			setCurrentIndex(Math.max(0, index ?? 0));
		};
		model.currentSegmentIndexChanged.connect(onIndexChanged);
		return () => {
			model.currentSegmentIndexChanged.disconnect(onIndexChanged);
		};
	}, [model]);

	const clearOverrideLayers = useCallback(() => {
		const entries = overrideLayerEntriesRef.current;
		if (!entries) return;
		entries.forEach(({ layerId, action }) => {
			if (action === 'remove') {
				removeLayer?.(layerId);
			} else {
				const layerOrSource = model.getLayerOrSource(layerId);
				if (layerOrSource) {
					model.triggerLayerUpdate(layerId, layerOrSource);
				}
			}
		});
		entries.length = 0;
	}, [model, overrideLayerEntriesRef, removeLayer]);

	useEffect(() => {
		const updateStory = () => {
			clearOverrideLayers();
			setStoryData(model.getSelectedStory().story ?? null);
			setCurrentIndex(model.getCurrentSegmentIndex() ?? 0);
		};
		updateStory();
		model.sharedModel.storyMapsChanged.connect(updateStory);
		return () => {
			model.sharedModel.storyMapsChanged.disconnect(updateStory);
		};
	}, [model, clearOverrideLayers]);

	const storySegments = useMemo(() => {
		if (!storyData?.storySegments) {
			return [];
		}
		return storyData.storySegments
			.map(segmentId => model.getLayer(segmentId))
			.filter((layer): layer is IJGISLayer => layer !== undefined);
	}, [storyData, model]);

	const segmentCount = storySegments.length;
	const storySegmentIds = storyData?.storySegments;

	const currentStorySegment = useMemo(
		() => storySegments[currentIndex],
		[storySegments, currentIndex],
	);

	const activeSlide = useMemo(
		() => currentStorySegment?.parameters,
		[currentStorySegment],
	);

	const layerName = useMemo(
		() => currentStorySegment?.name ?? '',
		[currentStorySegment],
	);

	const currentStorySegmentId = useMemo(
		() => storySegmentIds?.[currentIndex],
		[storySegmentIds, currentIndex],
	);

	const zoomToCurrentLayer = useCallback(() => {
		if (currentStorySegmentId) {
			model.centerOnPosition(currentStorySegmentId);
		}
	}, [model, currentStorySegmentId]);

	const setIndex = useCallback(
		(index: number) => {
			model.setCurrentSegmentIndex(index);
		},
		[model],
	);

	const hasPrev = currentIndex > 0;
	const hasNext = currentIndex < segmentCount - 1;

	const handlePrev = useCallback(() => {
		if (hasPrev) {
			model.setCurrentSegmentIndex(currentIndex - 1);
		}
	}, [model, currentIndex, hasPrev]);

	const handleNext = useCallback(() => {
		if (hasNext) {
			model.setCurrentSegmentIndex(currentIndex + 1);
		}
	}, [model, currentIndex, hasNext]);

	return {
		storyData,
		storySegments,
		currentIndex,
		clearOverrideLayers,
		setIndex,
		handlePrev,
		handleNext,
		hasPrev,
		hasNext,
		currentStorySegment,
		activeSlide,
		layerName,
		currentStorySegmentId,
		zoomToCurrentLayer,
	};
}

export interface IUseOverrideSymbologyParams {
	model: IJupyterGISModel;
	storySegments: IJGISLayer[];
	overrideLayerEntriesRef: React.RefObject<IOverrideLayerEntry[]>;
	addLayer?: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
}

/**
 * Returns a callback that applies layer overrides for the story segment at the given index.
 */
export function useOverrideSymbology({
	model,
	storySegments,
	overrideLayerEntriesRef,
	addLayer,
}: IUseOverrideSymbologyParams) {
	return useCallback(
		(index: number) => {
			if (index < 0 || !storySegments[index]) {
				return;
			}

			const segment = storySegments[index];
			const layerOverrides: IStorySegmentLayer['layerOverride'] = (
				segment.parameters as IStorySegmentLayer['parameters']
			)?.layerOverride;

			if (!Array.isArray(layerOverrides)) {
				return;
			}

			layerOverrides.forEach(override => {
				const {
					color,
					opacity,
					sourceProperties,
					symbologyState,
					targetLayer: targetLayerId,
					visible,
				} = override;

				if (!targetLayerId) {
					return;
				}

				overrideLayerEntriesRef.current?.push({
					layerId: targetLayerId,
					action: 'restore',
				});

				const targetLayer = model.getLayer(targetLayerId);

				if (targetLayer?.parameters) {
					if (symbologyState !== undefined) {
						targetLayer.parameters.symbologyState = symbologyState;
					}
					if (color !== undefined) {
						targetLayer.parameters.color = color;
					}
					if (opacity !== undefined) {
						targetLayer.parameters.opacity = opacity;
					}
					if (visible !== undefined) {
						targetLayer.visible = visible;
					}
					if (
						sourceProperties !== undefined &&
						Object.keys(sourceProperties).length > 0
					) {
						const sourceId = targetLayer.parameters?.source;
						if (sourceId) {
							const source = model.getSource(sourceId);
							if (!source) {
								return;
							}
							if (source?.parameters) {
								source.parameters = {
									...source.parameters,
									...sourceProperties,
								};
							}

							overrideLayerEntriesRef.current?.push({
								layerId: sourceId,
								action: 'restore',
							});

							model.triggerLayerUpdate(sourceId, source);
						}
					}
					if (symbologyState?.renderType === 'Heatmap') {
						targetLayer.type = 'HeatmapLayer';
						if (addLayer) {
							const newId = UUID.uuid4();
							addLayer(newId, targetLayer, 100);
							overrideLayerEntriesRef.current?.push({
								layerId: newId,
								action: 'remove',
							});
						}
					} else {
						model.triggerLayerUpdate(targetLayerId, targetLayer);
					}
				}
			});
		},
		[addLayer, model, storySegments, overrideLayerEntriesRef],
	);
}
