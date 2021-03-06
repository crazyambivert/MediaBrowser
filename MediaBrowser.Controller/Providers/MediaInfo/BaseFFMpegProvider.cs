﻿using MediaBrowser.Common.IO;
using MediaBrowser.Common.MediaInfo;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Logging;
using System;
using System.Threading.Tasks;

namespace MediaBrowser.Controller.Providers.MediaInfo
{
    /// <summary>
    /// Class BaseFFMpegProvider
    /// </summary>
    /// <typeparam name="T"></typeparam>
    public abstract class BaseFFMpegProvider<T> : BaseMetadataProvider
        where T : BaseItem
    {
        protected readonly IMediaEncoder MediaEncoder;

        protected BaseFFMpegProvider(ILogManager logManager, IServerConfigurationManager configurationManager, IMediaEncoder mediaEncoder) : base(logManager, configurationManager)
        {
            MediaEncoder = mediaEncoder;
        }

        /// <summary>
        /// Supportses the specified item.
        /// </summary>
        /// <param name="item">The item.</param>
        /// <returns><c>true</c> if XXXX, <c>false</c> otherwise</returns>
        public override bool Supports(BaseItem item)
        {
            return item.LocationType == LocationType.FileSystem && item is T;
        }

        /// <summary>
        /// Override this to return the date that should be compared to the last refresh date
        /// to determine if this provider should be re-fetched.
        /// </summary>
        /// <param name="item">The item.</param>
        /// <returns>DateTime.</returns>
        protected override DateTime CompareDate(BaseItem item)
        {
            return item.DateModified;
        }

        /// <summary>
        /// The null mount task result
        /// </summary>
        protected readonly Task<IIsoMount> NullMountTaskResult = Task.FromResult<IIsoMount>(null);

        /// <summary>
        /// Gets the provider version.
        /// </summary>
        /// <value>The provider version.</value>
        protected override string ProviderVersion
        {
            get
            {
                return MediaEncoder.Version;
            }
        }

        /// <summary>
        /// Needses the refresh internal.
        /// </summary>
        /// <param name="item">The item.</param>
        /// <param name="providerInfo">The provider info.</param>
        /// <returns><c>true</c> if XXXX, <c>false</c> otherwise</returns>
        protected override bool NeedsRefreshInternal(BaseItem item, BaseProviderInfo providerInfo)
        {
            // If the last run wasn't successful, try again when there's a new version of ffmpeg
            if (providerInfo.LastRefreshStatus != ProviderRefreshStatus.Success)
            {
                if (!string.Equals(ProviderVersion, providerInfo.ProviderVersion))
                {
                    return true;
                }
            }

            return base.NeedsRefreshInternal(item, providerInfo);
        }
    }
}
