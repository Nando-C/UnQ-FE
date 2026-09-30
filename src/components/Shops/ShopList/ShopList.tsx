import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  fetchShopList,
  selectShopsData,
  selectShopsDataStatus,
} from "../../../redux/slices/shopSlice";
import CustomerShopCard from "../../Customers/CustomerShopCard/CustomerShopCard";
import ShopCardPlaceholder from "../../Customers/CustomerShopCard/ShopCardPlaceholder";
import { Loading, LoadFailed } from "../../Common/ScreenStates";

// The same photo-on-top card and grid customers see on their home page, so a
// manager sees their shops the way customers will.
const ShopList = () => {
  const dispatch = useAppDispatch();
  const shopListStore = useAppSelector(selectShopsData);
  const status = useAppSelector(selectShopsDataStatus);

  if (shopListStore.length === 0 && status === "failed") {
    return (
      <LoadFailed
        message="Couldn't load your shops."
        onRetry={() => dispatch(fetchShopList())}
      />
    );
  }
  if (shopListStore.length === 0 && status !== "ready") {
    return (
      <Loading label="Loading your shops">
        <div className="shop-grid">
          <ShopCardPlaceholder />
          <ShopCardPlaceholder />
        </div>
      </Loading>
    );
  }

  return (
    <ul className="ShopList shop-grid list-unstyled">
      {shopListStore.map((shop) => (
        <li key={shop._id}>
          <Link className="shop-link" to={`/shop/${shop._id}`}>
            <CustomerShopCard
              name={shop.name}
              cover={shop.cover}
              bio={shop.bio}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default ShopList;
