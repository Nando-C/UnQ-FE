import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  fetchShopList,
  selectShopsData,
  selectShopsDataStatus,
} from "../../../redux/slices/shopSlice";
import CustomerShopCard from "../../Customers/CustomerShopCard/CustomerShopCard";
import ShopCardPlaceholder from "../../Customers/CustomerShopCard/ShopCardPlaceholder";
import ShopGlance from "../../Dashboard/ShopGlance";
import { Loading, LoadFailed } from "../../Common/ScreenStates";

// The same photo-on-top card and grid customers see on their home page, so a
// manager sees their shops the way customers will, with the shop's figures and
// what its tables need under the name (ShopGlance).
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
          <CustomerShopCard name={shop.name} cover={shop.cover} bio={shop.bio} to={`/shop/${shop._id}`}>
            <ShopGlance shop={shop} />
          </CustomerShopCard>
        </li>
      ))}
    </ul>
  );
};

export default ShopList;
