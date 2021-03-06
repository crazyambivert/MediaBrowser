﻿using MediaBrowser.Common.IO;
using MediaBrowser.Common.MediaInfo;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Providers.MediaInfo;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Logging;
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MediaBrowser.Controller.MediaInfo
{
    /// <summary>
    /// Class FFMpegManager
    /// </summary>
    public class FFMpegManager
    {
        /// <summary>
        /// Gets or sets the video image cache.
        /// </summary>
        /// <value>The video image cache.</value>
        internal FileSystemRepository VideoImageCache { get; set; }

        /// <summary>
        /// Gets or sets the subtitle cache.
        /// </summary>
        /// <value>The subtitle cache.</value>
        internal FileSystemRepository SubtitleCache { get; set; }

        private readonly ILibraryManager _libraryManager;

        private readonly IServerApplicationPaths _appPaths;
        private readonly IMediaEncoder _encoder;
        private readonly ILogger _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="FFMpegManager" /> class.
        /// </summary>
        /// <param name="appPaths">The app paths.</param>
        /// <param name="encoder">The encoder.</param>
        /// <param name="libraryManager">The library manager.</param>
        /// <param name="logger">The logger.</param>
        /// <exception cref="System.ArgumentNullException">zipClient</exception>
        public FFMpegManager(IServerApplicationPaths appPaths, IMediaEncoder encoder, ILibraryManager libraryManager, ILogger logger)
        {
            _appPaths = appPaths;
            _encoder = encoder;
            _libraryManager = libraryManager;
            _logger = logger;

            VideoImageCache = new FileSystemRepository(VideoImagesDataPath);
            SubtitleCache = new FileSystemRepository(SubtitleCachePath);
        }

        /// <summary>
        /// The _video images data path
        /// </summary>
        private string _videoImagesDataPath;
        /// <summary>
        /// Gets the video images data path.
        /// </summary>
        /// <value>The video images data path.</value>
        public string VideoImagesDataPath
        {
            get
            {
                if (_videoImagesDataPath == null)
                {
                    _videoImagesDataPath = Path.Combine(_appPaths.DataPath, "extracted-video-images");

                    if (!Directory.Exists(_videoImagesDataPath))
                    {
                        Directory.CreateDirectory(_videoImagesDataPath);
                    }
                }

                return _videoImagesDataPath;
            }
        }

        /// <summary>
        /// The _audio images data path
        /// </summary>
        private string _audioImagesDataPath;
        /// <summary>
        /// Gets the audio images data path.
        /// </summary>
        /// <value>The audio images data path.</value>
        public string AudioImagesDataPath
        {
            get
            {
                if (_audioImagesDataPath == null)
                {
                    _audioImagesDataPath = Path.Combine(_appPaths.DataPath, "extracted-audio-images");

                    if (!Directory.Exists(_audioImagesDataPath))
                    {
                        Directory.CreateDirectory(_audioImagesDataPath);
                    }
                }

                return _audioImagesDataPath;
            }
        }

        /// <summary>
        /// The _subtitle cache path
        /// </summary>
        private string _subtitleCachePath;
        /// <summary>
        /// Gets the subtitle cache path.
        /// </summary>
        /// <value>The subtitle cache path.</value>
        public string SubtitleCachePath
        {
            get
            {
                if (_subtitleCachePath == null)
                {
                    _subtitleCachePath = Path.Combine(_appPaths.CachePath, "subtitles");

                    if (!Directory.Exists(_subtitleCachePath))
                    {
                        Directory.CreateDirectory(_subtitleCachePath);
                    }
                }

                return _subtitleCachePath;
            }
        }
        
        /// <summary>
        /// The first chapter ticks
        /// </summary>
        private static readonly long FirstChapterTicks = TimeSpan.FromSeconds(15).Ticks;

        /// <summary>
        /// Extracts the chapter images.
        /// </summary>
        /// <param name="video">The video.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <param name="extractImages">if set to <c>true</c> [extract images].</param>
        /// <param name="saveItem">if set to <c>true</c> [save item].</param>
        /// <returns>Task.</returns>
        /// <exception cref="System.ArgumentNullException"></exception>
        public async Task PopulateChapterImages(Video video, CancellationToken cancellationToken, bool extractImages, bool saveItem)
        {
            if (video.Chapters == null)
            {
                throw new ArgumentNullException();
            }

            // Can't extract images if there are no video streams
            if (video.MediaStreams == null || video.MediaStreams.All(m => m.Type != MediaStreamType.Video))
            {
                return;
            }

            var changesMade = false;

            foreach (var chapter in video.Chapters)
            {
                var filename = video.Id + "_" + video.DateModified.Ticks + "_" + chapter.StartPositionTicks;

                var path = VideoImageCache.GetResourcePath(filename, ".jpg");

                if (!VideoImageCache.ContainsFilePath(path))
                {
                    if (extractImages)
                    {
                        if (video.VideoType == VideoType.HdDvd || video.VideoType == VideoType.Iso)
                        {
                            continue;
                        }

                        if (video.VideoType == VideoType.BluRay)
                        {
                            // Can only extract reliably on single file blurays
                            if (video.PlayableStreamFileNames == null || video.PlayableStreamFileNames.Count != 1)
                            {
                                continue;
                            }
                        }

                        // Add some time for the first chapter to make sure we don't end up with a black image
                        var time = chapter.StartPositionTicks == 0 ? TimeSpan.FromTicks(Math.Min(FirstChapterTicks, video.RunTimeTicks ?? 0)) : TimeSpan.FromTicks(chapter.StartPositionTicks);

                        InputType type;

                        var inputPath = MediaEncoderHelpers.GetInputArgument(video, null, out type);

                        try
                        {
                            await _encoder.ExtractImage(inputPath, type, time, path, cancellationToken).ConfigureAwait(false);
                            chapter.ImagePath = path;
                            changesMade = true;
                        }
                        catch
                        {
                            break;
                        }
                    }
                }
                else if (!string.Equals(path, chapter.ImagePath, StringComparison.OrdinalIgnoreCase))
                {
                    chapter.ImagePath = path;
                    changesMade = true;
                }
            }

            if (saveItem && changesMade)
            {
                await _libraryManager.UpdateItem(video, CancellationToken.None).ConfigureAwait(false);
            }
        }

        /// <summary>
        /// Gets the subtitle cache path.
        /// </summary>
        /// <param name="input">The input.</param>
        /// <param name="subtitleStreamIndex">Index of the subtitle stream.</param>
        /// <param name="offset">The offset.</param>
        /// <param name="outputExtension">The output extension.</param>
        /// <returns>System.String.</returns>
        public string GetSubtitleCachePath(Video input, int subtitleStreamIndex, TimeSpan? offset, string outputExtension)
        {
            var ticksParam = offset.HasValue ? "_" + offset.Value.Ticks : "";

            var stream = input.MediaStreams[subtitleStreamIndex];

            if (stream.IsExternal)
            {
                ticksParam += File.GetLastWriteTimeUtc(stream.Path).Ticks;
            }

            return SubtitleCache.GetResourcePath(input.Id + "_" + subtitleStreamIndex + "_" + input.DateModified.Ticks + ticksParam, outputExtension);
        }
    }
}
